/**
 * ZYREX STORE — API smoke tests.
 *
 * Boots the real Express server on a scratch data directory and exercises the
 * customer journey plus admin authorisation. Run with: npm test
 *
 * The suite fails loudly: any failed assertion exits non-zero.
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.TEST_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.resolve('.tmp-test-data');

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Cookie-aware fetch. Returns { status, data, cookie }. */
async function request(pathname, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);

  const sessionCookie = setCookies
    .map((c) => String(c).split(';')[0])
    .find((c) => c.includes('=')) || null;

  return { status: res.status, data, cookie: sessionCookie };
}

async function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Normalise list responses: { products } | { categories } | { items } | array. */
function listOf(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['products', 'items', 'data', 'categories', 'orders', 'addresses', 'coupons']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

const ADDRESS = {
  full_name: 'Test Customer',
  phone: '9876543210',
  email: 'buyer@example.com',
  line1: '42 Test Lane, Sector 5',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
};

async function run() {
  rmSync(DATA_DIR, { recursive: true, force: true });

  const server = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR,
      JWT_SECRET: 'test-secret-for-smoke-suite',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverLog = [];
  server.stdout.on('data', (d) => serverLog.push(d.toString()));
  server.stderr.on('data', (d) => serverLog.push(d.toString()));

  let exitCode = 0;
  try {
    const up = await waitForServer();
    if (!up) {
      console.error('Server did not start. Log:\n' + serverLog.join(''));
      process.exitCode = 1;
      return;
    }

    /* ------------------------------ Catalogue ----------------------------- */
    section('Catalogue');
    const health = await request('/api/health');
    check('GET /api/health returns 200', health.status === 200, `status ${health.status}`);

    const allProducts = await request('/api/products?limit=200');
    const products = listOf(allProducts.data);
    check('GET /api/products returns 200', allProducts.status === 200);
    check('catalogue has products', products.length > 0, `found ${products.length}`);

    const categories = await request('/api/categories');
    const categoryList = listOf(categories.data);
    check('GET /api/categories returns 10 categories', categoryList.length >= 10, `found ${categoryList.length}`);

    const firstSlug = categoryList[0]?.slug;
    const filtered = await request(`/api/products?category=${encodeURIComponent(firstSlug)}`);
    const filteredList = listOf(filtered.data);
    check(
      `category filter returns only ${firstSlug}`,
      filteredList.length > 0 && filteredList.every((p) => p.category_slug === firstSlug),
      `${filteredList.length} items`
    );

    const candidate = products[0];
    const detail = await request(`/api/products/${candidate.slug}`);
    check('GET /api/products/:slug returns 200', detail.status === 200);
    check('product detail has price and images', Number(detail.data?.product?.price) > 0 && (detail.data?.product?.images?.length || 0) > 0);

    // Clothing/footwear products require a size and colour selection.
    const simple = detail.data?.product || candidate;
    const size = simple.sizes?.[0] ?? null;
    const color = simple.colors?.[0] ?? null;

    const missing = await request('/api/products/this-slug-does-not-exist');
    check('unknown product returns 404', missing.status === 404, `status ${missing.status}`);

    const search = await request('/api/search/suggest?q=shirt');
    check('search suggestions respond 200', search.status === 200);

    /* -------------------------- Auth and session -------------------------- */
    section('Authentication');
    const email = `buyer${Date.now()}@example.com`;
    const register = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Test Customer', email, password: 'Customer@12345', phone: '9876543210' },
    });
    check('POST /api/auth/register returns 201', register.status === 201, `status ${register.status}`);
    check('registration sets a session cookie', Boolean(register.cookie));
    check('register response has no password hash', !JSON.stringify(register.data).includes('password_hash'));

    const customer = register.cookie;
    const me = await request('/api/auth/me', { cookie: customer });
    check('GET /api/auth/me returns the new customer', me.status === 200 && me.data?.user?.email === email);
    check('customer role is not admin', me.data?.user?.role !== 'admin');

    const weak = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Weak', email: `weak${Date.now()}@example.com`, password: '123' },
    });
    check('weak password is rejected', weak.status === 400, `status ${weak.status}`);

    const anon = await request('/api/auth/addresses');
    check('addresses require authentication', anon.status === 401, `status ${anon.status}`);

    const address = await request('/api/auth/addresses', { method: 'POST', body: ADDRESS, cookie: customer });
    check('POST /api/auth/addresses saves an address', address.status === 201 || address.status === 200, `status ${address.status}`);
    check(
      'saved address keeps the recipient name and address line',
      address.data?.address?.full_name === ADDRESS.full_name && address.data?.address?.line1 === ADDRESS.line1,
      JSON.stringify({ full_name: address.data?.address?.full_name, line1: address.data?.address?.line1 })
    );

    /* ----------------------------- Cart flow ------------------------------ */
    section('Cart');
    const add = await request('/api/cart', {
      method: 'POST',
      body: { product_id: simple.id, qty: 1, size, color },
      cookie: customer,
    });
    check('POST /api/cart adds an item', add.status === 201, `status ${add.status}`);
    check('cart has one line item', (add.data?.items?.length || 0) === 1, `items ${add.data?.items?.length}`);
    check('cart subtotal is positive', Number(add.data?.subtotal) > 0, `subtotal ${add.data?.subtotal}`);

    const lineId = add.data?.items?.[0]?.id;
    const patch = await request(`/api/cart/${lineId}`, { method: 'PATCH', body: { qty: 2 }, cookie: customer });
    check('PATCH /api/cart/:id updates quantity', patch.status === 200, `status ${patch.status}`);

    const cart = await request('/api/cart', { cookie: customer });
    check('cart persists the new quantity', cart.data?.items?.[0]?.qty === 2, `qty ${cart.data?.items?.[0]?.qty}`);

    const totals = cart.data || {};
    check(
      'cart total = subtotal - discount + shipping',
      Math.abs(Number(totals.total) - (Number(totals.subtotal) - Number(totals.discount) + Number(totals.shipping))) <= 1,
      JSON.stringify({ total: totals.total, subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping })
    );

    section('Coupons');
    const coupon = await request('/api/coupons/validate', {
      method: 'POST',
      body: { code: 'WELCOME10', subtotal: 1500 },
    });
    check('WELCOME10 validates above its minimum order', coupon.status === 200 && coupon.data?.ok === true, `status ${coupon.status}`);
    check('coupon returns a discount', Number(coupon.data?.discount) > 0);

    const badCoupon = await request('/api/coupons/validate', {
      method: 'POST',
      body: { code: 'NOT-A-REAL-CODE', subtotal: 1500 },
    });
    check('invalid coupon is rejected', badCoupon.status === 400, `status ${badCoupon.status}`);

    /* ---------------------------- Order flow ------------------------------ */
    section('Orders');
    const idempotency_key = `test-${Date.now()}`;
    const orderBody = {
      items: [{ product_id: simple.id, qty: 1, size, color }],
      address: ADDRESS,
      payment_method: 'cod',
      idempotency_key,
    };
    const order = await request('/api/orders', { method: 'POST', body: orderBody, cookie: customer });
    check('POST /api/orders creates an order', order.status === 201 || order.status === 200, `status ${order.status}`);
    check('order has a number', Boolean(order.data?.order?.order_number));
    check('order total is positive', Number(order.data?.order?.total) > 0);

    const duplicate = await request('/api/orders', { method: 'POST', body: orderBody, cookie: customer });
    check('duplicate idempotency key returns the same order', duplicate.data?.duplicate === true && duplicate.data?.order?.id === order.data?.order?.id);

    const history = await request('/api/orders', { cookie: customer });
    const orders = listOf(history.data);
    check('GET /api/orders lists the order', orders.some((o) => o.id === order.data?.order?.id));

    const orderNumber = order.data?.order?.order_number;
    const tracking = await request(`/api/track/${orderNumber}`, { cookie: customer });
    check('GET /api/track/:orderNumber returns a timeline', tracking.status === 200 && Array.isArray(tracking.data?.order?.timeline), `status ${tracking.status}`);

    const guestTrack = await request(`/api/track/${orderNumber}?email=${encodeURIComponent(ADDRESS.email)}`);
    check('guest can track with the order email', guestTrack.status === 200, `status ${guestTrack.status}`);

    const strangerTrack = await request(`/api/track/${orderNumber}?email=someone-else@example.com`);
    check('tracking rejects a wrong email', strangerTrack.status === 403, `status ${strangerTrack.status}`);

    const badAddress = await request('/api/orders', {
      method: 'POST',
      body: { items: [{ product_id: simple.id, qty: 1, size, color }], address: { ...ADDRESS, pincode: '12' }, payment_method: 'cod' },
      cookie: customer,
    });
    check('invalid PIN code is rejected', badAddress.status === 400, `status ${badAddress.status}`);

    /* ------------------------------ Payment ------------------------------- */
    section('Payments');
    const payConfig = await request('/api/payments/config');
    check('GET /api/payments/config responds 200', payConfig.status === 200);
    check('payment config never exposes a secret key', !JSON.stringify(payConfig.data).toLowerCase().includes('secret'));

    /* --------------------------- Admin control ---------------------------- */
    section('Admin authorisation');
    const denied = await request('/api/admin/stats', { cookie: customer });
    check('customer is rejected from /api/admin/stats', denied.status === 403, `status ${denied.status}`);

    const anonAdmin = await request('/api/admin/stats');
    check('anonymous visitor is rejected from admin API', anonAdmin.status === 401 || anonAdmin.status === 403, `status ${anonAdmin.status}`);

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@zyrexstore.com', password: 'Admin@12345' },
    });
    check('seeded administrator can sign in', adminLogin.status === 200, `status ${adminLogin.status}`);
    const adminCookie = adminLogin.cookie;

    const stats = await request('/api/admin/stats', { cookie: adminCookie });
    check('administrator reads /api/admin/stats', stats.status === 200, `status ${stats.status}`);
    check('stats include totals and a sales series', Boolean(stats.data?.totals) && Array.isArray(stats.data?.sales_by_day));

    const adminProducts = await request('/api/admin/products', { cookie: adminCookie });
    check('administrator lists products', adminProducts.status === 200);

    const createProduct = await request('/api/admin/products', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: 'Smoke Test Product',
        category_slug: firstSlug,
        price: 499,
        mrp: 999,
        stock: 7,
        description: 'Temporary product created by the automated smoke suite.',
      },
    });
    check('administrator creates a product', createProduct.status === 201 || createProduct.status === 200, `status ${createProduct.status}`);

    const createdId = createProduct.data?.product?.id;
    if (createdId) {
      const removed = await request(`/api/admin/products/${createdId}`, { method: 'DELETE', cookie: adminCookie });
      check('administrator deletes the test product', removed.status === 200 || removed.status === 204, `status ${removed.status}`);
    }

    const customerBlocked = await request('/api/admin/products', {
      method: 'POST',
      cookie: customer,
      body: { name: 'Should Not Exist', price: 1, stock: 1, category_slug: firstSlug },
    });
    check('customer cannot create products', customerBlocked.status === 403, `status ${customerBlocked.status}`);

    /* ------------------------------- Errors ------------------------------- */
    section('Error handling');
    const unknown = await request('/api/definitely-not-an-endpoint');
    check('unknown API endpoint returns JSON 404', unknown.status === 404 && Boolean(unknown.data?.error));

    const contact = await request('/api/contact', {
      method: 'POST',
      body: { name: 'Test', email: 'test@example.com', subject: 'Hello', message: 'Smoke test message.' },
    });
    check('contact form accepts a valid submission', contact.status === 200 || contact.status === 201, `status ${contact.status}`);

    const newsletter = await request('/api/newsletter', { method: 'POST', body: { email: 'news@example.com' } });
    check('newsletter accepts a valid email', newsletter.status === 200 || newsletter.status === 201, `status ${newsletter.status}`);
  } finally {
    server.kill('SIGTERM');
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

run().catch((err) => {
  console.error('Smoke suite crashed:', err);
  process.exitCode = 1;
});
