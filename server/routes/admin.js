/**
 * Administrator API. Every route in this router requires an authenticated user
 * with role === 'admin'; hiding the dashboard in the browser is not the gate.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { filter, find, insert, remove, update, table, getSetting, setSetting, persist, newId } from '../store.js';
import { requireAdmin } from '../auth.js';
import { ORDER_STATUSES } from './orders.js';
import { restoreStock } from '../lib/commerce.js';

const router = express.Router();
router.use(requireAdmin);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const uniqueSlug = (name, existing) => {
  const base = slugify(name) || `item-${Date.now()}`;
  let slug = base;
  let i = 2;
  while (existing.some((e) => e.slug === slug)) slug = `${base}-${i++}`;
  return slug;
};

const money = (n) => Math.max(0, Math.round(Number(n) || 0));

/* -------------------------------- Stats ---------------------------------- */

router.get('/stats', (_req, res) => {
  const orders = table('orders');
  const products = table('products');
  const users = table('users');
  const paid = orders.filter((o) => o.payment_status === 'paid' || o.payment_method === 'cod');
  const revenue = paid.filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded').reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => ['Order Placed', 'Payment Confirmed', 'Processing', 'Packed'].includes(o.status)).length;
  const completed = orders.filter((o) => o.status === 'Delivered').length;
  const cancelled = orders.filter((o) => o.status === 'Cancelled').length;
  const lowStock = products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 10);

  const days = [...Array(14)].map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    const key = d.toISOString().slice(0, 10);
    const dayOrders = orders.filter((o) => String(o.created_at).slice(0, 10) === key);
    return {
      date: key,
      orders: dayOrders.length,
      revenue: dayOrders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0),
    };
  });

  const statusBreakdown = ORDER_STATUSES.map((status) => ({ status, count: orders.filter((o) => o.status === status).length }));
  const bestsellers = products.slice().sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 8);
  const recentOrders = orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  res.json({
    totals: {
      revenue,
      orders: orders.length,
      customers: users.filter((u) => u.role === 'customer').length,
      products: products.length,
      pending,
      completed,
      cancelled,
      low_stock: products.filter((p) => p.stock <= 5).length,
      open_tickets: table('tickets').filter((t) => t.status === 'open').length,
      subscribers: table('newsletter').length,
    },
    sales_by_day: days,
    status_breakdown: statusBreakdown,
    bestsellers: bestsellers.map((p) => ({ id: p.id, name: p.name, sold: p.sold_count, price: p.price, stock: p.stock, image: p.images[0] })),
    low_stock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, slug: p.slug })),
    recent_orders: recentOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      total: o.total,
      status: o.status,
      payment_status: o.payment_status,
      created_at: o.created_at,
      customer: o.address?.full_name,
    })),
  });
});

/* ------------------------------- Products -------------------------------- */

router.get('/products', (req, res) => {
  const term = String(req.query.q || '').toLowerCase().trim();
  const category = String(req.query.category || '');
  let rows = table('products').slice();
  if (term) rows = rows.filter((p) => `${p.name} ${p.brand} ${p.slug}`.toLowerCase().includes(term));
  if (category) rows = rows.filter((p) => p.category_slug === category);
  if (req.query.low_stock === 'true') rows = rows.filter((p) => p.stock <= 5);
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  res.json({ products: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, pages: Math.ceil(rows.length / limit) || 1 });
});

function productPayload(body, existing = null) {
  const name = String(body.name || existing?.name || '').trim();
  if (!name) return { error: 'Product name is required.' };
  const mrp = money(body.mrp ?? existing?.mrp ?? 0);
  const price = money(body.price ?? existing?.price ?? 0);
  if (price <= 0) return { error: 'Selling price must be greater than zero.' };
  if (mrp < price) return { error: 'MRP cannot be lower than the selling price.' };
  const category = find('categories', (c) => c.slug === (body.category_slug || existing?.category_slug));
  if (!category) return { error: 'Choose a valid category.' };
  const sub = find('subcategories', (s) => s.slug === (body.subcategory_slug || existing?.subcategory_slug) && s.category_slug === category.slug);
  const stock = Math.max(0, Number(body.stock ?? existing?.stock ?? 0));
  const images = Array.isArray(body.images)
    ? body.images.filter(Boolean).slice(0, 6)
    : typeof body.images === 'string'
      ? body.images.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
      : existing?.images || [];
  const sizes = Array.isArray(body.sizes) ? body.sizes.filter(Boolean) : typeof body.sizes === 'string' ? body.sizes.split(',').map((s) => s.trim()).filter(Boolean) : existing?.sizes || [];
  const colors = Array.isArray(body.colors) ? body.colors.filter(Boolean) : typeof body.colors === 'string' ? body.colors.split(',').map((s) => s.trim()).filter(Boolean) : existing?.colors || [];
  const slug = existing?.slug || uniqueSlug(name, table('products'));
  const gallery = images.length
    ? images
    : [0, 1, 2].map(
        (v) => `/api/img/product/${slug}-${v}.svg?v=${v}&glyph=${category.glyph || 'box'}&hue=${category.hue || 250}&label=${encodeURIComponent(sub?.name || category.name)}`
      );
  return {
    data: {
      name,
      slug,
      brand: String(body.brand || existing?.brand || 'ZYREX').trim(),
      seller: String(body.seller || existing?.seller || 'ZYREX Retail').trim(),
      category_slug: category.slug,
      category_name: category.name,
      subcategory_slug: sub?.slug || '',
      subcategory_name: sub?.name || '',
      group_name: sub?.group_name || '',
      description: String(body.description ?? existing?.description ?? '').slice(0, 4000),
      highlights: Array.isArray(body.highlights) ? body.highlights.slice(0, 8) : existing?.highlights || [],
      mrp,
      price,
      discount_percent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
      stock,
      in_stock: stock > 0,
      sizes,
      colors,
      specs: typeof body.specs === 'object' && body.specs ? body.specs : existing?.specs || {},
      images: gallery,
      delivery_days: Math.max(1, Number(body.delivery_days ?? existing?.delivery_days ?? 4)),
      return_days: Math.max(0, Number(body.return_days ?? existing?.return_days ?? 7)),
      returnable: body.returnable !== undefined ? Boolean(body.returnable) : existing?.returnable !== false,
      warranty: String(body.warranty ?? existing?.warranty ?? ''),
      featured: body.featured !== undefined ? Boolean(body.featured) : existing?.featured || false,
      bestseller: body.bestseller !== undefined ? Boolean(body.bestseller) : existing?.bestseller || false,
      new_arrival: body.new_arrival !== undefined ? Boolean(body.new_arrival) : existing?.new_arrival || false,
      tags: Array.isArray(body.tags) ? body.tags : existing?.tags || [],
    },
  };
}

router.post('/products', (req, res) => {
  const built = productPayload(req.body || {});
  if (built.error) return res.status(400).json({ error: built.error });
  const product = insert('products', {
    ...built.data,
    demo: false,
    rating: 0,
    review_count: 0,
    rating_breakdown: {},
    sold_count: 0,
  });
  res.status(201).json({ product });
});

router.patch('/products/:id', (req, res) => {
  const existing = find('products', (p) => p.id === req.params.id || p.slug === req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const built = productPayload(req.body || {}, existing);
  if (built.error) return res.status(400).json({ error: built.error });
  const product = update('products', existing.id, built.data);
  res.json({ product });
});

router.delete('/products/:id', (req, res) => {
  const existing = find('products', (p) => p.id === req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  remove('products', (p) => p.id === existing.id);
  remove('cart_items', (c) => c.product_id === existing.id);
  remove('wishlist_items', (w) => w.product_id === existing.id);
  res.json({ ok: true });
});

/* ----------------------------- Image upload ------------------------------ */

const UPLOAD_DIR = path.resolve(process.env.DATA_DIR || './data', 'uploads');
router.post('/uploads', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '2mb' }), (req, res) => {
  const type = String(req.headers['content-type'] || '');
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 32) return res.status(400).json({ error: 'Upload a PNG, JPEG or WebP image.' });
  const signatures = {
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
  };
  const sig = signatures[type];
  if (!sig || !sig.every((b, i) => buf[i] === b)) return res.status(400).json({ error: 'File content does not match a supported image type.' });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  const name = `${newId()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.status(201).json({ url: `/api/uploads/${name}` });
});

/* ---------------------------- Categories --------------------------------- */

router.get('/categories', (_req, res) => {
  res.json({
    categories: table('categories').slice().sort((a, b) => a.position - b.position),
    subcategories: table('subcategories').slice().sort((a, b) => a.position - b.position),
  });
});

router.post('/categories', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  const category = insert('categories', {
    slug: uniqueSlug(name, table('categories')),
    name,
    tagline: String(req.body?.tagline || ''),
    glyph: String(req.body?.glyph || 'box'),
    hue: Number(req.body?.hue) || 250,
    position: table('categories').length + 1,
    banner: `/api/img/category/${slugify(name)}.svg?glyph=${req.body?.glyph || 'box'}&hue=${Number(req.body?.hue) || 250}&label=${encodeURIComponent(name)}&w=1600&h=420`,
  });
  res.status(201).json({ category });
});

router.patch('/categories/:id', (req, res) => {
  const category = find('categories', (c) => c.id === req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  const updated = update('categories', category.id, {
    name: String(req.body?.name || category.name).trim(),
    tagline: String(req.body?.tagline ?? category.tagline),
  });
  res.json({ category: updated });
});

router.post('/subcategories', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const category = find('categories', (c) => c.slug === req.body?.category_slug);
  if (!name || !category) return res.status(400).json({ error: 'Subcategory name and category are required.' });
  const subcategory = insert('subcategories', {
    category_slug: category.slug,
    slug: uniqueSlug(name, table('subcategories')),
    name,
    group_name: String(req.body?.group_name || category.name),
    position: table('subcategories').length + 1,
  });
  res.status(201).json({ subcategory });
});

/* -------------------------------- Orders --------------------------------- */

router.get('/orders', (req, res) => {
  const status = String(req.query.status || '');
  const term = String(req.query.q || '').toLowerCase();
  let rows = table('orders').slice();
  if (status) rows = rows.filter((o) => o.status === status);
  if (term)
    rows = rows.filter((o) =>
      `${o.order_number} ${o.address?.full_name || ''} ${o.address?.email || ''} ${o.address?.phone || ''}`.toLowerCase().includes(term)
    );
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  res.json({ orders: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, pages: Math.ceil(rows.length / limit) || 1, statuses: ORDER_STATUSES });
});

router.get('/orders/:id', (req, res) => {
  const order = find('orders', (o) => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order, statuses: ORDER_STATUSES });
});

router.patch('/orders/:id/status', (req, res) => {
  const order = find('orders', (o) => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const status = String(req.body?.status || '');
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown order status.' });
  if (order.status === status) return res.json({ order });
  if (order.status === 'Cancelled' && status !== 'Refunded') {
    return res.status(409).json({ error: 'A cancelled order can only move to Refunded.' });
  }
  const timeline = [...(order.timeline || []), { status, note: String(req.body?.note || `Status updated to ${status}.`), at: new Date().toISOString() }];
  const patch = { status, timeline };
  if (status === 'Delivered') patch.delivered_at = new Date().toISOString();
  if (status === 'Cancelled') restoreStock(order.items);
  if (status === 'Refunded') patch.payment_status = 'refunded';
  const updated = update('orders', order.id, patch);
  persist();
  res.json({ order: updated });
});

router.patch('/orders/:id/payment', (req, res) => {
  const order = find('orders', (o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const allowed = ['awaiting_payment', 'paid', 'cod_pending', 'failed', 'refunded', 'refund_pending'];
  const paymentStatus = String(req.body?.payment_status || '');
  if (!allowed.includes(paymentStatus)) return res.status(400).json({ error: 'Unknown payment status.' });
  const updated = update('orders', order.id, {
    payment_status: paymentStatus,
    timeline: [...(order.timeline || []), { status: order.status, note: `Payment marked ${paymentStatus} by admin.`, at: new Date().toISOString() }],
  });
  res.json({ order: updated });
});

/* ------------------------------- Customers ------------------------------- */

router.get('/customers', (req, res) => {
  const term = String(req.query.q || '').toLowerCase();
  const orders = table('orders');
  let users = table('users').filter((u) => u.role !== 'admin' || req.query.include_admins === 'true');
  if (term) users = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(term));
  const customers = users.map((u) => {
    const own = orders.filter((o) => o.user_id === u.id);
    const { password_hash, reset_token, ...safe } = u;
    return {
      ...safe,
      orders: own.length,
      spent: own.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0),
      last_order: own.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at || null,
    };
  });
  res.json({ customers });
});

router.patch('/customers/:id/role', (req, res) => {
  const user = find('users', (u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Customer not found.' });
  const role = String(req.body?.role || '');
  if (!['customer', 'admin'].includes(role)) return res.status(400).json({ error: 'Unknown role.' });
  if (user.id === req.auth.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own administrator role.' });
  }
  const updated = update('users', user.id, { role });
  res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
});

/* -------------------------------- Coupons -------------------------------- */

router.get('/coupons', (_req, res) => {
  res.json({ coupons: table('coupons').slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.post('/coupons', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return res.status(400).json({ error: 'Use 3-24 letters, digits, dash or underscore.' });
  if (find('coupons', (c) => c.code.toUpperCase() === code)) return res.status(409).json({ error: 'This coupon code already exists.' });
  const type = ['percent', 'flat', 'shipping'].includes(req.body?.type) ? req.body.type : 'percent';
  const coupon = insert('coupons', {
    code,
    description: String(req.body?.description || '').slice(0, 200),
    type,
    value: Number(req.body?.value) || 0,
    min_order: Number(req.body?.min_order) || 0,
    max_discount: Number(req.body?.max_discount) || 0,
    campaign: String(req.body?.campaign || 'Promotion'),
    active: req.body?.active !== false,
    usage_limit: Number(req.body?.usage_limit) || 100000,
    used_count: 0,
    starts_at: req.body?.starts_at || new Date().toISOString(),
    expires_at: req.body?.expires_at || new Date(Date.now() + 90 * 86400000).toISOString(),
  });
  res.status(201).json({ coupon });
});

router.patch('/coupons/:id', (req, res) => {
  const coupon = find('coupons', (c) => c.id === req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
  const patch = {};
  for (const key of ['description', 'campaign', 'starts_at', 'expires_at']) {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  }
  for (const key of ['value', 'min_order', 'max_discount', 'usage_limit']) {
    if (req.body?.[key] !== undefined) patch[key] = Number(req.body[key]) || 0;
  }
  if (req.body?.active !== undefined) patch.active = Boolean(req.body.active);
  if (req.body?.type && ['percent', 'flat', 'shipping'].includes(req.body.type)) patch.type = req.body.type;
  res.json({ coupon: update('coupons', coupon.id, patch) });
});

router.delete('/coupons/:id', (req, res) => {
  remove('coupons', (c) => c.id === req.params.id);
  res.json({ ok: true });
});

/* ----------------------------- Blog / Vlog ------------------------------- */

for (const [collection, kind] of [
  ['blog_posts', 'blog'],
  ['vlog_posts', 'vlog'],
]) {
  router.get(`/${kind}`, (_req, res) => {
    res.json({ posts: table(collection).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  });

  router.post(`/${kind}`, (req, res) => {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    const base = {
      slug: uniqueSlug(title, table(collection)),
      title,
      published: req.body?.published !== false,
      published_at: req.body?.published_at || new Date().toISOString(),
      cover: String(req.body?.cover || `/api/img/${kind}/${slugify(title)}.svg?glyph=book&hue=260&label=${encodeURIComponent(kind.toUpperCase())}&w=1200&h=700`),
    };
    const extra =
      kind === 'blog'
        ? {
            category: String(req.body?.category || 'Shopping Tips'),
            excerpt: String(req.body?.excerpt || '').slice(0, 300),
            body: String(req.body?.body || ''),
            author: String(req.body?.author || 'ZYREX Editorial'),
            read_minutes: Math.max(1, Math.round(String(req.body?.body || '').split(/\s+/).length / 200)),
          }
        : {
            description: String(req.body?.description || ''),
            duration: String(req.body?.duration || ''),
            youtube_id: String(req.body?.youtube_id || ''),
            youtube_search: String(req.body?.youtube_search || ''),
          };
    res.status(201).json({ post: insert(collection, { ...base, ...extra }) });
  });

  router.patch(`/${kind}/:id`, (req, res) => {
    const post = find(collection, (p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const patch = {};
    for (const key of ['title', 'category', 'excerpt', 'body', 'author', 'description', 'duration', 'youtube_id', 'youtube_search', 'cover', 'published_at']) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    if (req.body?.published !== undefined) patch.published = Boolean(req.body.published);
    res.json({ post: update(collection, post.id, patch) });
  });

  router.delete(`/${kind}/:id`, (req, res) => {
    remove(collection, (p) => p.id === req.params.id);
    res.json({ ok: true });
  });
}

/* -------------------------------- Tickets -------------------------------- */

router.get('/tickets', (_req, res) => {
  res.json({ tickets: table('tickets').slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.patch('/tickets/:id', (req, res) => {
  const ticket = find('tickets', (t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
  const patch = {};
  if (req.body?.status && ['open', 'in_progress', 'resolved', 'closed'].includes(req.body.status)) patch.status = req.body.status;
  if (req.body?.reply) {
    patch.replies = [...(ticket.replies || []), { by: req.auth.name, message: String(req.body.reply).slice(0, 2000), at: new Date().toISOString() }];
    patch.status = patch.status || 'in_progress';
  }
  res.json({ ticket: update('tickets', ticket.id, patch) });
});

/* ------------------------------- Settings -------------------------------- */

router.get('/settings', (_req, res) => {
  res.json({
    brand: getSetting('brand', {}),
    commerce: getSetting('commerce', {}),
    faqs: getSetting('faqs', []),
  });
});

router.patch('/settings', (req, res) => {
  if (req.body?.brand && typeof req.body.brand === 'object') {
    setSetting('brand', { ...getSetting('brand', {}), ...req.body.brand });
  }
  if (req.body?.commerce && typeof req.body.commerce === 'object') {
    const c = req.body.commerce;
    const patch = {};
    if (c.cod_enabled !== undefined) patch.cod_enabled = Boolean(c.cod_enabled);
    for (const key of ['shipping_fee', 'free_shipping_threshold', 'cod_limit']) {
      if (c[key] !== undefined) patch[key] = Math.max(0, Number(c[key]) || 0);
    }
    setSetting('commerce', { ...getSetting('commerce', {}), ...patch });
  }
  if (Array.isArray(req.body?.faqs)) {
    setSetting(
      'faqs',
      req.body.faqs
        .filter((f) => (f.question || f.q) && (f.answer || f.a))
        .map((f) => ({ question: f.question || f.q, answer: f.answer || f.a, category: f.category || 'General' }))
    );
  }
  res.json({ ok: true, brand: getSetting('brand', {}), commerce: getSetting('commerce', {}), faqs: getSetting('faqs', []) });
});

/* ------------------------------- Reviews --------------------------------- */

router.get('/reviews', (_req, res) => {
  res.json({ reviews: table('reviews').slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200) });
});

router.delete('/reviews/:id', (req, res) => {
  remove('reviews', (r) => r.id === req.params.id);
  res.json({ ok: true });
});

/* ----------------------------- Newsletter -------------------------------- */

router.get('/newsletter', (_req, res) => {
  res.json({ subscribers: table('newsletter').slice().reverse() });
});

export default router;
