/**
 * ZYREX STORE — shared commerce helpers.
 *
 * All money is handled in whole rupees (integers) on the server; the browser only
 * displays what the server calculated. Coupons are validated here so a client can
 * never invent a discount.
 */
import { filter, find, getSetting, table } from '../store.js';

export function siteSettings() {
  return {
    brand: getSetting('brand', {}),
    commerce: getSetting('commerce', {}),
    faqs: getSetting('faqs', []),
  };
}

export function commerceConfig() {
  const c = getSetting('commerce', {}) || {};
  return {
    currency: c.currency || 'INR',
    cod_enabled: c.cod_enabled !== false,
    shipping_fee: Number(c.shipping_fee ?? 49),
    free_shipping_threshold: Number(c.free_shipping_threshold ?? 999),
    cod_limit: Number(c.cod_limit ?? 25000),
  };
}

export function activeCoupons() {
  const now = Date.now();
  return filter('coupons', (c) => c.active && (!c.expires_at || new Date(c.expires_at).getTime() > now));
}

/**
 * Validate a coupon code against a subtotal.
 * @returns {{ok:boolean, message:string, coupon?:object, discount:number, freeShipping:boolean}}
 */
export function validateCoupon(code, subtotal) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { ok: false, message: 'Enter a coupon code.', discount: 0, freeShipping: false };
  const coupon = find('coupons', (c) => String(c.code).toUpperCase() === clean);
  if (!coupon) return { ok: false, message: 'This coupon code is not valid.', discount: 0, freeShipping: false };
  if (!coupon.active) return { ok: false, message: 'This coupon is no longer active.', discount: 0, freeShipping: false };
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > Date.now()) {
    return { ok: false, message: 'This offer has not started yet.', discount: 0, freeShipping: false };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'This coupon has expired.', discount: 0, freeShipping: false };
  }
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, message: 'This coupon has reached its usage limit.', discount: 0, freeShipping: false };
  }
  if (Number(coupon.min_order || 0) > subtotal) {
    return {
      ok: false,
      message: `Add items worth ₹${Number(coupon.min_order) - subtotal} more to use ${coupon.code}.`,
      discount: 0,
      freeShipping: false,
    };
  }
  if (coupon.type === 'shipping') {
    return { ok: true, message: `${coupon.code} applied — free delivery.`, coupon, discount: 0, freeShipping: true };
  }
  let discount = coupon.type === 'flat' ? Number(coupon.value) : Math.round((subtotal * Number(coupon.value)) / 100);
  if (coupon.max_discount) discount = Math.min(discount, Number(coupon.max_discount));
  discount = Math.max(0, Math.min(discount, subtotal));
  return { ok: true, message: `${coupon.code} applied — you saved ₹${discount}.`, coupon, discount, freeShipping: false };
}

export function totalsFor(subtotal, couponCode) {
  const cfg = commerceConfig();
  const applied = couponCode ? validateCoupon(couponCode, subtotal) : null;
  const discount = applied && applied.ok ? applied.discount : 0;
  const freeShip = Boolean(applied && applied.ok && applied.freeShipping);
  const shipping =
    subtotal === 0 || freeShip || subtotal >= cfg.free_shipping_threshold ? 0 : cfg.shipping_fee;
  const total = Math.max(0, subtotal - discount) + shipping;
  return { subtotal, discount, shipping, total, coupon: applied && applied.ok ? applied.coupon : null, couponMessage: applied?.message || '', freeShipping: freeShip };
}

/** Cart rows enriched with current product data (price always from the database). */
export function cartItemsFor(userId) {
  const rows = filter('cart_items', (c) => c.user_id === userId);
  const items = [];
  for (const row of rows) {
    const product = find('products', (p) => p.id === row.product_id);
    if (!product) continue;
    items.push({
      id: row.id,
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image: product.images[0],
      price: product.price,
      mrp: product.mrp,
      qty: row.qty,
      size: row.size || null,
      color: row.color || null,
      stock: product.stock,
      in_stock: product.stock > 0,
      line_total: product.price * row.qty,
      line_mrp: product.mrp * row.qty,
    });
  }
  return items;
}

export function cartSummary(userId, couponCode) {
  const items = cartItemsFor(userId);
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const mrpTotal = items.reduce((s, i) => s + i.line_mrp, 0);
  const totals = totalsFor(subtotal, couponCode);
  return {
    items,
    count: items.reduce((s, i) => s + i.qty, 0),
    mrp_total: mrpTotal,
    savings: mrpTotal - subtotal + totals.discount,
    ...totals,
  };
}

export function orderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ZX-${stamp}-${rand}`;
}

export function decrementStock(items) {
  const products = table('products');
  for (const item of items) {
    const p = products.find((x) => x.id === item.product_id);
    if (!p) continue;
    p.stock = Math.max(0, p.stock - item.qty);
    p.in_stock = p.stock > 0;
    p.sold_count = (p.sold_count || 0) + item.qty;
  }
}

export function restoreStock(items) {
  const products = table('products');
  for (const item of items) {
    const p = products.find((x) => x.id === item.product_id);
    if (!p) continue;
    p.stock += item.qty;
    p.in_stock = true;
  }
}
