/**
 * Optional Supabase (Postgres) persistence.
 *
 * The storefront keeps an in-memory document model (see `store.js`) and mirrors
 * every mutation into Supabase Postgres when a reachable project is configured.
 * Documents are stored in `public.store_documents` as (collection, id, payload)
 * so the adapter does not depend on a per-table column list.
 *
 * Credentials are read from the environment only — never from source:
 *   SUPABASE_URL                     project URL
 *   SUPABASE_SERVICE_ROLE_KEY        server-side key (required for writes)
 *   SUPABASE_ANON_KEY                fallback for reads
 *
 * The service-role key bypasses Row Level Security, so it stays on the server
 * and is never sent to the browser or committed to Git.
 */

import { runtimeEnvPresence, buildEnvSnapshot } from './env-report.js';

const RAW_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
const ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const KEY = SERVICE_KEY || ANON_KEY;

const TABLE = 'store_documents';
const TIMEOUT_MS = 8000;

const safeHost = (value) => {
  try {
    return new URL(value).host;
  } catch {
    return 'invalid-url';
  }
};

const state = {
  configured: Boolean(RAW_URL && KEY),
  projectHost: RAW_URL ? safeHost(RAW_URL) : null,
  keyKind: SERVICE_KEY ? 'service_role' : ANON_KEY ? 'anon' : 'none',
  writesEnabled: Boolean(RAW_URL && SERVICE_KEY),
  reachable: null,
  httpStatus: null,
  detail: null,
  backend: 'file',
  rowsLoaded: 0,
  hydratedAt: null,
  lastWriteError: null,
};

/** Pending mutations: collection -> Map(id -> row | null for delete). */
const pending = new Map();

const authHeaders = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${RAW_URL}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Sanitised status for the diagnostics endpoint — never includes key material. */
export function storageStatus() {
  return {
    backend: state.backend,
    // Presence-only diagnostics: distinguishes "variable missing" from
    // "variable never reaches this stage". No values are exposed.
    env: {
      runtime: runtimeEnvPresence(),
      build: buildEnvSnapshot(),
    },
    supabase: {
      configured: state.configured,
      projectHost: state.projectHost,
      keyKind: state.keyKind,
      writesEnabled: state.writesEnabled,
      reachable: state.reachable,
      httpStatus: state.httpStatus,
      detail: state.detail,
      rowsLoaded: state.rowsLoaded,
      hydratedAt: state.hydratedAt,
      lastWriteError: state.lastWriteError,
    },
  };
}

export const supabaseConfigured = () => state.configured;
export const supabaseWritable = () => state.writesEnabled && state.reachable === true;

/**
 * Probe the project, pull existing documents and mark the backend.
 * Falls back to the file store with an explicit reason when unavailable.
 */
export async function initSupabase(collections, replaceCollection) {
  if (!state.configured) {
    state.detail = 'SUPABASE_URL or a Supabase key is not set in the environment.';
    return storageStatus();
  }

  try {
    const res = await request(`/rest/v1/${TABLE}?select=collection&limit=1`);
    state.httpStatus = res.status;

    if (!res.ok) {
      state.reachable = false;
      state.backend = 'file';
      if (res.status === 401 || res.status === 403) {
        state.detail =
          `Supabase rejected the ${state.keyKind} key (HTTP ${res.status}). ` +
          (state.keyKind === 'anon'
            ? 'Server-side writes need SUPABASE_SERVICE_ROLE_KEY in Settings → Environment variables.'
            : 'Check that the key belongs to this project and has not been rotated.');
      } else if (res.status === 404) {
        state.detail = `Table ${TABLE} is missing. Apply supabase/store-documents.sql to this project.`;
      } else {
        state.detail = `Supabase responded HTTP ${res.status}.`;
      }
      console.warn('[supabase] falling back to the file store:', state.detail);
      return storageStatus();
    }

    state.reachable = true;
    state.backend = 'supabase';

    const rowsRes = await request(`/rest/v1/${TABLE}?select=collection,id,payload`);
    if (!rowsRes.ok) {
      state.detail = `Connected, but reading documents failed (HTTP ${rowsRes.status}).`;
      state.backend = 'file';
      return storageStatus();
    }

    const rows = await rowsRes.json();
    const grouped = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row?.collection) continue;
      if (!grouped.has(row.collection)) grouped.set(row.collection, []);
      grouped.get(row.collection).push({ ...row.payload, id: row.id });
    }

    for (const [collection, docs] of grouped) {
      if (collections.includes(collection) && docs.length) replaceCollection(collection, docs);
    }

    state.rowsLoaded = rows.length;
    state.hydratedAt = new Date().toISOString();
    state.detail = state.writesEnabled
      ? 'Hydrated from Supabase; writes are mirrored to Postgres.'
      : 'Hydrated from Supabase; writes stay local because no service-role key is set.';
    return storageStatus();
  } catch (err) {
    state.reachable = false;
    state.backend = 'file';
    state.detail =
      err.name === 'AbortError'
        ? `Supabase did not answer within ${TIMEOUT_MS} ms.`
        : `Supabase request failed: ${err.message}`;
    console.warn('[supabase] falling back to the file store:', state.detail);
    return storageStatus();
  }
}

function enqueue(collection, id, row) {
  if (!state.writesEnabled) return;
  if (!pending.has(collection)) pending.set(collection, new Map());
  pending.get(collection).set(id, row);
}

export const queueUpsert = (collection, row) => row?.id && enqueue(collection, row.id, row);
export const queueDelete = (collection, id) => id && enqueue(collection, id, null);

/** Push queued mutations to Postgres. Errors are recorded, never thrown at callers. */
export async function flushSupabase() {
  if (!state.writesEnabled || state.reachable !== true || pending.size === 0) return;

  for (const [collection, entries] of pending) {
    pending.delete(collection);
    const upserts = [];
    const deletes = [];
    for (const [id, row] of entries) (row ? upserts : deletes).push(row || id);

    try {
      if (upserts.length) {
        const res = await request(`/rest/v1/${TABLE}?on_conflict=collection,id`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(
            upserts.map((row) => ({ collection, id: row.id, payload: row, updated_at: new Date().toISOString() }))
          ),
        });
        if (!res.ok) throw new Error(`upsert HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      }
      if (deletes.length) {
        // One request per id: PostgREST `in.(...)` lists cannot carry arbitrary
        // document ids (e.g. the settings row id "site") safely.
        for (const id of deletes) {
          const res = await request(
            `/rest/v1/${TABLE}?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`,
            { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
          );
          if (!res.ok) throw new Error(`delete HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
        }
      }
      state.lastWriteError = null;
    } catch (err) {
      state.lastWriteError = err.message;
      console.error(`[supabase] write to ${collection} failed:`, err.message);
    }
  }
}
