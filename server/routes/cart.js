/**
 * Cart, wishlist and coupon routes. Prices and stock always come from the
 * database; the browser only sends product ids, quantities and variants.
 */
import express from 'express';
import { filter, find, insert, remove, update, table } from '../store.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { cartSummary, activeCoupons, validateCoupon, cartItemsFor } from '../lib/commerce.js';

const router = express.Router();

function variantError(product, size, color) {
  if (product.sizes?.length && !product.sizes.includes(size)) return 'Please select an available size.';
  if (product.colors?.length && !product.colors.includes(color)) return 'Please select an available colour.';
  return null;
}

router.get('/cart', optionalAuth, (req, res) => {
  if (!req.user) return res.json({ items: [], count: 0, subtotal: 0, discount: 0, shipping: 0, total: 0, savings: 0, coupon: null });
  res.json(cartSummary(req.user.id, req.query.coupon));
});

router.post('/cart', requireAuth, (req, res) => {
  const { product_id, size = null, color = null } = req.body || {};
  const qty = Math.max(1, Math.min(10, Number(req.body?.qty) || 1));
  const product = find('products', (p) => p.id === product_id || p.slug === product_id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < 1) return res.status(409).json({ error: 'This product is out of stock.' });
  const err = variantError(product, size, color);
  if (err) return res.status(400).json({ error: err });

  const existing = find(
    'cart_items',
    (c) => c.user_id === req.auth.id && c.product_id === product.id && c.size === size && c.color === color
  );
  const nextQty = Math.min(product.stock, (existing?.qty || 0) + qty);
  if (existing) {
    update('cart_items', existing.id, { qty: nextQty });
  } else {
    insert('cart_items', { user_id: req.auth.id, product_id: product.id, qty: nextQty, size, color });
  }
  res.status(201).json(cartSummary(req.auth.id, req.body?.coupon));
});

router.patch('/cart/:id', requireAuth, (req, res) => {
  const row = find('cart_items', (c) => c.id === req.params.id && c.user_id === req.auth.id);
  if (!row) return res.status(404).json({ error: 'Cart item not found.' });
  const product = find('products', (p) => p.id === row.product_id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const qty = Number(req.body?.qty);
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Enter a valid quantity.' });
  if (qty === 0) {
    remove('cart_items', (c) => c.id === row.id);
    return res.json(cartSummary(req.auth.id, req.body?.coupon));
  }
  if (qty > product.stock) {
    return res.status(409).json({ error: `Only ${product.stock} left in stock.` });
  }
  update('cart_items', row.id, { qty: Math.min(10, qty) });
  res.json(cartSummary(req.auth.id, req.body?.coupon));
});

router.delete('/cart/:id', requireAuth, (req, res) => {
  remove('cart_items', (c) => c.id === req.params.id && c.user_id === req.auth.id);
  res.json(cartSummary(req.auth.id, req.query.coupon));
});

router.delete('/cart', requireAuth, (req, res) => {
  remove('cart_items', (c) => c.user_id === req.auth.id);
  res.json(cartSummary(req.auth.id));
});

/** Merge a guest (localStorage) cart after sign-in. */
router.post('/cart/merge', requireAuth, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 40) : [];
  for (const item of items) {
    const product = find('products', (p) => p.id === item.product_id || p.slug === item.product_id);
    if (!product || product.stock < 1) continue;
    const size = item.size || null;
    const color = item.color || null;
    if (variantError(product, size, color)) continue;
    const qty = Math.max(1, Math.min(product.stock, Number(item.qty) || 1));
    const existing = find(
      'cart_items',
      (c) => c.user_id === req.auth.id && c.product_id === product.id && c.size === size && c.color === color
    );
    if (existing) update('cart_items', existing.id, { qty: Math.min(product.stock, existing.qty + qty) });
    else insert('cart_items', { user_id: req.auth.id, product_id: product.id, qty, size, color });
  }
  res.json(cartSummary(req.auth.id));
});

/** Pre-checkout stock validation. */
router.post('/cart/validate', requireAuth, (req, res) => {
  const items = cartItemsFor(req.auth.id);
  const issues = items
    .filter((i) => !i.in_stock || i.qty > i.stock)
    .map((i) => ({ product_id: i.product_id, name: i.name, available: i.stock, requested: i.qty }));
  res.json({ ok: issues.length === 0, issues });
});

/* ------------------------------- Wishlist -------------------------------- */

router.get('/wishlist', requireAuth, (req, res) => {
  const rows = filter('wishlist_items', (w) => w.user_id === req.auth.id);
  const items = rows
    .map((r) => {
      const p = find('products', (x) => x.id === r.product_id);
      return p ? { id: r.id, product: p } : null;
    })
    .filter(Boolean);
  res.json({ items });
});

router.post('/wishlist', requireAuth, (req, res) => {
  const product = find('products', (p) => p.id === req.body?.product_id || p.slug === req.body?.product_id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!find('wishlist_items', (w) => w.user_id === req.auth.id && w.product_id === product.id)) {
    insert('wishlist_items', { user_id: req.auth.id, product_id: product.id });
  }
  res.status(201).json({ ok: true });
});

router.delete('/wishlist/:productId', requireAuth, (req, res) => {
  remove('wishlist_items', (w) => w.user_id === req.auth.id && (w.product_id === req.params.productId || w.id === req.params.productId));
  res.json({ ok: true });
});

router.post('/wishlist/:productId/move-to-cart', requireAuth, (req, res) => {
  const product = find('products', (p) => p.id === req.params.productId || p.slug === req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < 1) return res.status(409).json({ error: 'This product is out of stock.' });
  const size = req.body?.size || product.sizes?.[0] || null;
  const color = req.body?.color || product.colors?.[0] || null;
  const existing = find(
    'cart_items',
    (c) => c.user_id === req.auth.id && c.product_id === product.id && c.size === size && c.color === color
  );
  if (existing) update('cart_items', existing.id, { qty: Math.min(product.stock, existing.qty + 1) });
  else insert('cart_items', { user_id: req.auth.id, product_id: product.id, qty: 1, size, color });
  remove('wishlist_items', (w) => w.user_id === req.auth.id && w.product_id === product.id);
  res.json(cartSummary(req.auth.id));
});

/* -------------------------------- Coupons -------------------------------- */

router.get('/coupons', (_req, res) => {
  const coupons = activeCoupons().map((c) => ({
    code: c.code,
    description: c.description,
    campaign: c.campaign,
    type: c.type,
    value: c.value,
    min_order: c.min_order,
    max_discount: c.max_discount,
    expires_at: c.expires_at,
  }));
  res.json({ coupons });
});

router.post('/coupons/validate', optionalAuth, (req, res) => {
  const code = String(req.body?.code || '');
  let subtotal = Number(req.body?.subtotal) || 0;
  if (req.user) subtotal = cartSummary(req.user.id).subtotal;
  const result = validateCoupon(code, subtotal);
  if (!result.ok) return res.status(400).json({ error: result.message });
  res.json({
    ok: true,
    message: result.message,
    discount: result.discount,
    free_shipping: result.freeShipping,
    coupon: { code: result.coupon.code, description: result.coupon.description },
  });
});

export default router;
