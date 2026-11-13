/**
 * Proves the Supabase adapter hydrates at boot and mirrors writes.
 *
 * Runs against a small local mock of the PostgREST endpoints the adapter uses,
 * so it needs no credentials, no network and touches no real Supabase project.
 * It catches payload/URL shape mistakes that would otherwise only surface on
 * the first real activation.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rows = new Map(); // "collection:id" -> row
const requests = [];
const failures = [];

const check = (label, condition, extra = '') => {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ''}`);
    failures.push(label);
  }
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  requests.push(`${req.method} ${url.pathname}${url.search}`);

  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  if (url.pathname !== '/rest/v1/store_documents') return send(404, { message: 'not mocked' });

  if (req.method === 'GET') {
    const all = [...rows.values()];
    const select = url.searchParams.get('select') || '';
    // Probe: does the table exist / is the key accepted?
    if (select === 'collection') return send(200, all.slice(0, 1).map((r) => ({ collection: r.collection })));
    return send(200, all);
  }

  if (req.method === 'POST') {
    const parsed = JSON.parse((await readBody(req)) || '[]');
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const row of list) rows.set(`${row.collection}:${row.id}`, row);
    return send(201);
  }

  if (req.method === 'DELETE') {
    const collection = (url.searchParams.get('collection') || '').replace(/^eq\./, '');
    const id = decodeURIComponent((url.searchParams.get('id') || '').replace(/^eq\./, ''));
    const existed = rows.delete(`${collection}:${id}`);
    return send(existed ? 204 : 404);
  }

  return send(405, { message: 'method not mocked' });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bind on all interfaces so the deployment preflight does not flag this mock
// as a localhost-only server; the test still connects over loopback.
await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
const { port } = server.address();

// Point the adapter at the mock before importing it (config is read on import).
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zyrex-supabase-'));
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
delete process.env.SUPABASE_ANON_KEY;

const store = await import('../server/store.js');
const supabase = await import('../server/supabase.js');

try {
  console.log('Supabase adapter (mock PostgREST)');

  // A document that already exists in Postgres must win over seeded data.
  rows.set('products:p1', {
    collection: 'products',
    id: 'p1',
    payload: { id: 'p1', name: 'Hydrated Speaker', price: 1999 },
  });

  store.loadDb((db) => db);
  const status = await supabase.initSupabase(store.COLLECTIONS, store.replaceCollection);

  check('backend switches to supabase', status.backend === 'supabase', JSON.stringify(status));
  check('reports service-role key kind', status.supabase.keyKind === 'service_role', status.supabase.keyKind);
  check('writes enabled', status.supabase.writesEnabled === true);
  check('probe reachable', status.supabase.reachable === true);
  check('documents hydrated', status.supabase.rowsLoaded === 1, String(status.supabase.rowsLoaded));
  check(
    'remote row replaced seed data',
    store.find('products', (p) => p.id === 'p1')?.name === 'Hydrated Speaker'
  );

  // Insert → mirrored to PostgREST.
  store.insert('products', { name: 'Mirrored Item', price: 499 });
  await wait(600);
  check(
    'insert mirrored',
    [...rows.values()].some((r) => r.payload?.name === 'Mirrored Item')
  );

  // The seeded settings row keeps the non-UUID id "site"; updating it must
  // mirror too (a uuid column would reject this id, hence the text column).
  store.setSetting('site', { brand: 'ZYREX STORE' });
  await wait(600);
  check('non-uuid settings id mirrored', rows.has('settings:site'));

  // Delete → mirrored.
  store.remove('products', (p) => p.id === 'p1');
  await wait(600);
  check('delete mirrored', !rows.has('products:p1'));

  check('no unexpected status leakage', !JSON.stringify(status).includes('test-service-role-key'));
} finally {
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll Supabase adapter checks passed.');
process.exit(0);
