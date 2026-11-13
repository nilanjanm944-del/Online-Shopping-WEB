/**
 * Order lifecycle + Razorpay checkout routes.
 *
 * Money is recalculated on the server from current product prices; the client
 * cannot submit its own totals. Stock is decremented only when an order is
 * created, restored when it is cancelled or a payment fails, and payment
 * confirmation always requires a verified gateway signature.
 */
import express from 'express';
import { filter, find, insert, remove, update, persist } from '../store.js';
import { requireAuth, requireAdmin, optionalAuth } from '../auth.js';
import {
  cartItemsFor,
  cartSummary,
  commerceConfig,
  decrementStock,
  orderNumber,
  restoreStock,
  validateCoupon,
} from '../lib/commerce.js';
import {
  createRazorpayOrder,
  fetchPayment,
  razorpayConfigured,
  razorpayPublicConfig,
  sandboxPaymentsEnabled,
  verifyPaymentSignature,
} from '../payments.js';
import { rateLimit } from '../lib/rate-limit.js';
import { normalizeAddress, validateAddress } from '../lib/address.js';

const router = express.Router();

export const ORDER_STATUSES = [
  'Order Placed',
  'Payment Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Return Requested',
  'Refunded',
];

const nowIso = () => new Date().toISOString();

function pushTimeline(order, status, note) {
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  timeline.push({ status, note, at: nowIso() });
  return timeline;
}

/** Build order items from either the server cart or an explicit item list. */
function resolveItems(userId, body) {
  if (Array.isArray(body?.items) && body.items.length) {
    const items = [];
    for (const raw of body.items.slice(0, 40)) {
      const product = find('products', (p) => p.id === raw.product_id || p.slug === raw.product_id);
      if (!product) return { error: 'One of the products is no longer available.' };
      const qty = Math.max(1, Math.min(10, Number(raw.qty) || 1));
      const size = raw.size || null;
      const color = raw.color || null;
      if (product.sizes?.length && !product.sizes.includes(size)) return { error: `Choose a size for ${product.name}.` };
      if (product.colors?.length && !product.colors.includes(color)) return { error: `Choose a colour for ${product.name}.` };
      if (product.stock < qty) return { error: `Only ${product.stock} left of ${product.name}.` };
      items.push({
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: product.images[0],
        price: product.price,
        mrp: product.mrp,
        qty,
        size,
        color,
        line_total: product.price * qty,
      });
    }
    return { items };
  }
  const items = cartItemsFor(userId).map((i) => ({
    product_id: i.product_id,
    slug: i.slug,
    name: i.name,
    brand: i.brand,
    image: i.image,
    price: i.price,
    mrp: i.mrp,
    qty: i.qty,
    size: i.size,
    color: i.color,
    line_total: i.line_total,
  }));
  if (!items.length) return { error: 'Your cart is empty.' };
  for (const i of items) {
    if (!i.in_stock && i.stock === 0) return { error: `${i.name} is out of stock.` };
  }
  return { items };
}

router.get('/payments/config', (_req, res) => {
  res.json({
    razorpay: razorpayPublicConfig(),
    sandbox: { enabled: sandboxPaymentsEnabled(), mode: 'test' },
    cod_enabled: commerceConfig().cod_enabled,
    cod_limit: commerceConfig().cod_limit,
    currency: commerceConfig().currency,
  });
});

router.post('/orders', requireAuth, rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const body = req.body || {};
  const cfg = commerceConfig();

  // Duplicate-order protection: a repeated idempotency key returns the same order.
  const key = String(body.idempotency_key || '').trim();
  if (key) {
    const existing = find('orders', (o) => o.user_id === req.auth.id && o.idempotency_key === key);
    if (existing) return res.status(200).json({ order: existing, duplicate: true });
  }

  const { items, error } = resolveItems(req.auth.id, body);
  if (error) return res.status(400).json({ error });

  let address = body.address || null;
  if (body.address_id) {
    const saved = find('addresses', (a) => a.id === body.address_id && a.user_id === req.auth.id);
    if (!saved) return res.status(400).json({ error: 'Saved address not found.' });
    address = { ...saved };
  }
  // Saved addresses may use name/line1 while checkout sends full_name/line1.
  address = normalizeAddress(address);
  const addressError = validateAddress(address, { requireEmail: true });
  if (addressError) return res.status(400).json({ error: addressError });

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const mrpTotal = items.reduce((s, i) => s + i.line_mrp, 0);
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();
  let discount = 0;
  let freeShip = false;
  let coupon = null;
  if (couponCode) {
    const applied = validateCoupon(couponCode, subtotal);
    if (!applied.ok) return res.status(400).json({ error: applied.message });
    discount = applied.discount;
    freeShip = applied.freeShipping;
    coupon = applied.coupon;
  }
  const shipping = freeShip || subtotal >= cfg.free_shipping_threshold ? 0 : cfg.shipping_fee;
  const total = Math.max(0, subtotal - discount) + shipping;

  const requested = String(body.payment_method || '').toLowerCase();
  const method = requested === 'cod' ? 'cod' : requested === 'sandbox' ? 'sandbox' : 'razorpay';
  if (method === 'cod') {
    if (!cfg.cod_enabled) return res.status(400).json({ error: 'Cash on Delivery is not available.' });
    if (total > cfg.cod_limit) {
      return res.status(400).json({ error: `Cash on Delivery is available up to ₹${cfg.cod_limit}.` });
    }
  } else if (method === 'sandbox') {
    if (!sandboxPaymentsEnabled()) {
      return res.status(503).json({ error: 'Test payments are disabled on this store.', code: 'sandbox_disabled' });
    }
  } else if (!razorpayConfigured()) {
    return res.status(503).json({
      error:
        'Online payment is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings → Environment variables, or choose Cash on Delivery.',
      code: 'razorpay_not_configured',
    });
  }

  const order = insert('orders', {
    order_number: orderNumber(),
    user_id: req.auth.id,
    items,
    subtotal,
    discount,
    shipping,
    total,
    mrp_total: mrpTotal,
    savings: mrpTotal - subtotal + discount,
    coupon_code: coupon ? coupon.code : null,
    payment_method: method,
    payment_gateway: method === 'cod' ? 'cod' : method === 'sandbox' ? 'sandbox' : 'razorpay',
    payment_status: method === 'cod' ? 'cod_pending' : method === 'sandbox' ? 'test_pending' : 'awaiting_payment',
    status: 'Order Placed',
    address,
    notes: String(body.notes || '').slice(0, 500),
    timeline: [
      {
        status: 'Order Placed',
        note:
          method === 'cod'
            ? 'Order placed with Cash on Delivery.'
            : method === 'sandbox'
              ? 'Order placed with test-mode payment. No money is charged.'
              : 'Order placed. Waiting for payment confirmation.',
        at: nowIso(),
      },
    ],
    idempotency_key: key || null,
    razorpay_order_id: null,
    razorpay_payment_id: null,
  });

  decrementStock(items);
  if (coupon) {
    update('coupons', coupon.id, { used_count: (coupon.used_count || 0) + 1 });
    insert('coupon_usage', { coupon_id: coupon.id, user_id: req.auth.id, order_id: order.id, discount });
  }
  remove('cart_items', (c) => c.user_id === req.auth.id);
  persist();
  res.status(201).json({ order });
});

router.get('/orders', requireAuth, (req, res) => {
  const orders = filter('orders', (o) => o.user_id === req.auth.id).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  res.json({ orders });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = find(
    'orders',
    (o) => (o.id === req.params.id || o.order_number === req.params.id) && o.user_id === req.auth.id
  );
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order, statuses: ORDER_STATUSES });
});

/** Public tracking lookup by order number + email (no account needed). */
router.get('/track/:orderNumber', optionalAuth, (req, res) => {
  const order = find('orders', (o) => o.order_number === req.params.orderNumber);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const email = String(req.query.email || '').toLowerCase();
  const owner = req.user && (req.user.id === order.user_id || req.user.role === 'admin');
  if (!owner && (!email || email !== String(order.address?.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Enter the email used for this order to track it.' });
  }
  res.json({
    order: {
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      timeline: order.timeline,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image, price: i.price })),
      total: order.total,
      created_at: order.created_at,
    },
  });
});

router.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const order = find('orders', (o) => o.id === req.params.id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const cancellable = ['Order Placed', 'Payment Confirmed', 'Processing'];
  if (!cancellable.includes(order.status)) {
    return res.status(409).json({ error: `An order that is ${order.status.toLowerCase()} can no longer be cancelled.` });
  }
  restoreStock(order.items);
  const status = 'Cancelled';
  const updated = update('orders', order.id, {
    status,
    payment_status: order.payment_status === 'paid' ? 'refund_pending' : order.payment_status,
    cancel_reason: String(req.body?.reason || 'Cancelled by customer').slice(0, 300),
    timeline: pushTimeline(order, status, String(req.body?.reason || 'Cancelled by customer')),
  });
  persist();
  res.json({ order: updated });
});

router.post('/orders/:id/return', requireAuth, (req, res) => {
  const order = find('orders', (o) => o.id === req.params.id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'Delivered') {
    return res.status(409).json({ error: 'A return can be requested only after delivery.' });
  }
  const delivered = order.delivered_at ? new Date(order.delivered_at) : null;
  const windowDays = Math.min(...order.items.map((i) => Number(find('products', (p) => p.id === i.product_id)?.return_days ?? 7)));
  if (delivered && (Date.now() - delivered.getTime()) / 86_400_000 > windowDays) {
    return res.status(409).json({ error: `The ${windowDays}-day return window has closed.` });
  }
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5) return res.status(400).json({ error: 'Please describe the reason for the return.' });
  const updated = update('orders', order.id, {
    status: 'Return Requested',
    return_reason: reason.slice(0, 500),
    timeline: pushTimeline(order, 'Return Requested', reason.slice(0, 300)),
  });
  res.json({ order: updated });
});

/* --------------------------- Razorpay checkout --------------------------- */

router.post('/payments/razorpay/order', requireAuth, async (req, res) => {
  const order = find('orders', (o) => o.id === req.body?.order_id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_method !== 'razorpay') return res.status(400).json({ error: 'This order is not an online payment order.' });
  if (order.payment_status === 'paid') return res.status(409).json({ error: 'This order is already paid.' });
  if (!razorpayConfigured()) {
    return res.status(503).json({
      error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings → Environment variables.',
      code: 'razorpay_not_configured',
    });
  }
  const created = await createRazorpayOrder({
    amountInPaise: order.total * 100,
    receipt: order.order_number,
    notes: { order_id: order.id, order_number: order.order_number },
  });
  if (!created.ok) return res.status(502).json({ error: created.error });
  update('orders', order.id, { razorpay_order_id: created.order.id });
  res.json({
    key_id: razorpayPublicConfig().key_id,
    razorpay_order_id: created.order.id,
    amount: created.order.amount,
    currency: created.order.currency,
    order_number: order.order_number,
    name: 'ZYREX STORE',
    prefill: { name: order.address?.full_name, email: order.address?.email, contact: order.address?.phone },
  });
});

router.post('/payments/razorpay/verify', requireAuth, rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const order = find('orders', (o) => o.id === order_id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (order.payment_status === 'paid') {
    return res.json({ ok: true, order, duplicate: true });
  }
  if (order.razorpay_order_id && razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) {
    return res.status(400).json({ error: 'Payment does not belong to this order.' });
  }
  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    update('orders', order.id, {
      payment_status: 'failed',
      timeline: pushTimeline(order, order.status, 'Payment signature verification failed.'),
    });
    return res.status(400).json({ error: 'Payment verification failed. No order was confirmed.' });
  }
  // Confirm the gateway's own record and amount before trusting the callback.
  const looked = await fetchPayment(razorpay_payment_id);
  if (!looked.ok) return res.status(502).json({ error: looked.error });
  const payment = looked.payment;
  if (!['captured', 'authorized'].includes(payment.status)) {
    return res.status(402).json({ error: `Payment is ${payment.status}, not captured.` });
  }
  if (Number(payment.amount) !== order.total * 100) {
    return res.status(400).json({ error: 'Paid amount does not match the order total.' });
  }
  if (order.razorpay_order_id && payment.order_id !== order.razorpay_order_id) {
    return res.status(400).json({ error: 'Payment order mismatch.' });
  }
  const updated = update('orders', order.id, {
    payment_status: 'paid',
    status: 'Payment Confirmed',
    razorpay_payment_id,
    razorpay_signature,
    paid_at: nowIso(),
    timeline: pushTimeline(order, 'Payment Confirmed', `Payment ${razorpay_payment_id} verified and captured.`),
  });
  res.json({ ok: true, order: updated });
});

router.post('/payments/razorpay/failed', requireAuth, (req, res) => {
  const order = find('orders', (o) => o.id === req.body?.order_id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_status === 'paid') return res.status(409).json({ error: 'This order is already paid.' });
  restoreStock(order.items);
  const updated = update('orders', order.id, {
    payment_status: 'failed',
    status: 'Cancelled',
    cancel_reason: 'Payment failed or was cancelled',
    timeline: pushTimeline(order, 'Cancelled', 'Payment failed or was cancelled by the customer. Stock released.'),
  });
  persist();
  res.json({ ok: true, order: updated });
});

/* ------------------------ Test-mode (sandbox) payment ----------------------- */

router.post('/payments/sandbox/confirm', requireAuth, rateLimit({ windowMs: 60_000, max: 30 }), (req, res) => {
  if (!sandboxPaymentsEnabled()) {
    return res.status(503).json({ error: 'Test payments are disabled on this store.', code: 'sandbox_disabled' });
  }
  const order = find('orders', (o) => o.id === req.body?.order_id && o.user_id === req.auth.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_method !== 'sandbox') {
    return res.status(400).json({ error: 'This order is not a test-payment order.' });
  }
  // Idempotent: a retried confirmation never double-processes an order.
  if (order.payment_status === 'paid') return res.json({ ok: true, order, duplicate: true });
  if (order.status === 'Cancelled') {
    return res.status(409).json({ error: 'This order was cancelled and cannot be paid.' });
  }

  const outcome = req.body?.outcome === 'failure' ? 'failure' : 'success';
  if (outcome === 'failure') {
    restoreStock(order.items);
    const failed = update('orders', order.id, {
      payment_status: 'failed',
      status: 'Cancelled',
      cancel_reason: 'Test payment declined',
      timeline: pushTimeline(
        order,
        'Cancelled',
        'Test-mode payment declined. No money was charged and stock was released.'
      ),
    });
    persist();
    return res.json({ ok: true, outcome: 'failure', order: failed });
  }

  const reference = `TESTPAY-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const updated = update('orders', order.id, {
    payment_gateway: 'sandbox',
    payment_status: 'paid',
    status: 'Payment Confirmed',
    sandbox_reference: reference,
    paid_at: nowIso(),
    timeline: pushTimeline(
      order,
      'Payment Confirmed',
      `Test-mode payment ${reference} approved. No money was charged.`
    ),
  });
  persist();
  res.json({ ok: true, outcome: 'success', order: updated, reference });
});

/* ------------------------- Admin order endpoints ------------------------- */

router.get('/admin/orders/export', requireAdmin, (_req, res) => {
  const orders = filter('orders', () => true);
  const header = 'order_number,created_at,status,payment_method,payment_status,total,customer,email\n';
  const rows = orders
    .map((o) =>
      [
        o.order_number,
        o.created_at,
        o.status,
        o.payment_method,
        o.payment_status,
        o.total,
        `"${o.address?.full_name || ''}"`,
        o.address?.email || '',
      ].join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="zyrex-orders.csv"');
  res.send(header + rows);
});

export default router;
