/**
 * Verify the server-side Supabase key really writes.
 *
 * Proves, against the live project (not a mock):
 *   1. the configured key can insert into public.store_documents
 *   2. the row reads back
 *   3. writing the same id again updates instead of duplicating
 *   4. delete removes it
 *   5. the anon key still cannot read those rows (RLS intact)
 *   6. the anon key still cannot write (RLS intact)
 *
 * Statuses and row counts only — key material is never printed.
 * Cleans up after itself; exits non-zero if any check fails.
 *
 * Usage: node scripts/verify-supabase-write.mjs
 */

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const anon = (process.env.SUPABASE_ANON_KEY || '').trim()

if (!url || !key) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment')
  process.exit(1)
}

const table = `${url}/rest/v1/store_documents`
const auth = { apikey: key, Authorization: `Bearer ${key}` }
const json = { ...auth, 'Content-Type': 'application/json' }

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const rowsOf = async (res) => {
  const body = await res.json().catch(() => [])
  return Array.isArray(body) ? body : []
}

// 1. write
const ins = await fetch(`${table}?on_conflict=collection,id`, {
  method: 'POST',
  headers: { ...json, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{ collection: 'diagnostics', id: 'write-probe', payload: { ok: true, step: 1 } }]),
})
check('server key writes a row', ins.status === 200 || ins.status === 201, `HTTP ${ins.status}`)

// 2. read back
const readRes = await fetch(`${table}?collection=eq.diagnostics&id=eq.write-probe&select=id,payload`, {
  headers: auth,
})
const readRows = await rowsOf(readRes)
check(
  'row reads back',
  readRes.status === 200 && readRows.length === 1 && readRows[0]?.payload?.step === 1,
  `HTTP ${readRes.status} rows=${readRows.length}`,
)

// 3. duplicate protection
const dup = await fetch(`${table}?on_conflict=collection,id`, {
  method: 'POST',
  headers: { ...json, Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify([{ collection: 'diagnostics', id: 'write-probe', payload: { ok: true, step: 2 } }]),
})
const dupRows = await rowsOf(
  await fetch(`${table}?collection=eq.diagnostics&id=eq.write-probe&select=payload`, { headers: auth }),
)
check(
  'repeat write updates instead of duplicating',
  (dup.status === 200 || dup.status === 201) && dupRows.length === 1 && dupRows[0]?.payload?.step === 2,
  `HTTP ${dup.status} rows=${dupRows.length} step=${dupRows[0]?.payload?.step}`,
)

// 4. delete
const del = await fetch(`${table}?collection=eq.diagnostics&id=eq.write-probe`, { method: 'DELETE', headers: auth })
const afterRows = await rowsOf(await fetch(`${table}?collection=eq.diagnostics&select=id`, { headers: auth }))
check(
  'delete removes the row',
  (del.status === 204 || del.status === 200) && afterRows.length === 0,
  `HTTP ${del.status} remaining=${afterRows.length}`,
)

// 5 + 6. RLS must still block the public key
if (anon) {
  const anonAuth = { apikey: anon, Authorization: `Bearer ${anon}` }
  const anonRead = await fetch(`${table}?select=id`, { headers: anonAuth })
  const anonRows = await rowsOf(anonRead)
  check(
    'anon key cannot read rows (RLS intact)',
    anonRead.status === 200 && anonRows.length === 0,
    `HTTP ${anonRead.status} rows=${anonRows.length}`,
  )

  const anonWrite = await fetch(table, {
    method: 'POST',
    headers: { ...anonAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ collection: 'diagnostics', id: 'anon-should-fail', payload: {} }]),
  })
  check(
    'anon key cannot write (RLS intact)',
    anonWrite.status >= 400,
    `HTTP ${anonWrite.status}`,
  )
  // Belt and braces: if a policy ever let that insert through, remove it.
  if (anonWrite.status < 400) {
    await fetch(`${table}?collection=eq.diagnostics&id=eq.anon-should-fail`, { method: 'DELETE', headers: auth })
  }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exit(1)
