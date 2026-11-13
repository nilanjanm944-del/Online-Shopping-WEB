/**
 * Verify end-to-end persistence on the DEPLOYED app.
 *
 * A real mutation through the public API must end up in Supabase Postgres:
 *   1. the live app reports writes enabled and a reachable project
 *   2. a newsletter subscription is accepted by the API
 *   3. the mirror reports no write error
 *   4. the row is actually present in public.store_documents (read directly
 *      with the server key, which is independent of the app)
 *
 * Cleans up the test row. Key material is never printed.
 *
 * Usage: node scripts/verify-live-persistence.mjs [appUrl]
 */

const APP = (process.argv[2] || process.env.APP_URL || 'https://vulesrkzir.dev.onappjet.com').replace(/\/+$/, '')
const SB = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

if (!SB || !KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment')
  process.exit(1)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const storage = async () => {
  const res = await fetch(`${APP}/api/system/storage`)
  const body = await res.json().catch(() => ({}))
  return { http: res.status, sb: body.supabase || {}, backend: body.backend }
}

const before = await storage()
check(
  'live app reports writes enabled',
  before.sb.writesEnabled === true,
  `backend=${before.backend} keyKind=${before.sb.keyKind} writesEnabled=${before.sb.writesEnabled}`,
)
check(
  'live app is reachable with a 200 from the project',
  before.sb.reachable === true && before.sb.httpStatus === 200,
  `httpStatus=${before.sb.httpStatus} rowsLoaded=${before.sb.rowsLoaded}`,
)

const email = `verify+${Date.now()}@example.com`
const post = await fetch(`${APP}/api/newsletter`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
})
check('newsletter subscription accepted by the live API', post.status === 200 || post.status === 201, `HTTP ${post.status}`)

// Give the mirror's flush a moment to reach Postgres.
await new Promise((resolve) => setTimeout(resolve, 2000))

const after = await storage()
check(
  'mirror reports no write error',
  !after.sb.lastWriteError,
  `lastWriteError=${after.sb.lastWriteError || 'none'}`,
)
console.log(`note: rowsLoaded before=${before.sb.rowsLoaded} after=${after.sb.rowsLoaded}`)

// Independent proof: read the row straight from Postgres with the server key.
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const query = await fetch(
  `${SB}/rest/v1/store_documents?select=collection,id,payload&payload->>email=eq.${encodeURIComponent(email)}`,
  { headers: auth },
)
const rows = await query.json().catch(() => [])
const found = Array.isArray(rows)
  ? rows.find((row) => String(row?.payload?.email || '').toLowerCase() === email.toLowerCase())
  : null
check(
  'subscriber row persisted in Postgres',
  Boolean(found),
  `HTTP ${query.status} rows=${Array.isArray(rows) ? rows.length : '?'}`,
)

if (found) {
  const del = await fetch(
    `${SB}/rest/v1/store_documents?collection=eq.${encodeURIComponent(found.collection)}&id=eq.${encodeURIComponent(found.id)}`,
    { method: 'DELETE', headers: auth },
  )
  console.log(`cleanup: removed the test subscriber (HTTP ${del.status})`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exit(1)
