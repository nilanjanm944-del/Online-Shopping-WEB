/**
 * ZYREX STORE — persistence layer.
 *
 * A small, dependency-free document store with atomic JSON writes. It keeps the
 * same collection/column names as the PostgreSQL schema in `supabase/schema.sql`
 * so the API layer can be pointed at Supabase without renaming anything.
 *
 * Collections: users, addresses, categories, subcategories, products, reviews,
 * cart_items, wishlist_items, orders, coupons, coupon_usage, blog_posts,
 * vlog_posts, newsletter, tickets, recently_viewed, settings.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueUpsert, queueDelete, flushSupabase } from './supabase.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const COLLECTIONS = [
  'users',
  'addresses',
  'categories',
  'subcategories',
  'products',
  'reviews',
  'cart_items',
  'wishlist_items',
  'orders',
  'coupons',
  'coupon_usage',
  'blog_posts',
  'vlog_posts',
  'newsletter',
  'tickets',
  'recently_viewed',
  'settings',
];

let db = null;
let writeTimer = null;

export const newId = () => crypto.randomUUID();

function emptyDb() {
  const base = {};
  for (const c of COLLECTIONS) base[c] = [];
  base.settings = [{ id: 'site', key: 'site', value: {} }];
  return base;
}

export function loadDb(seedFn) {
  if (db) return db;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...emptyDb(), ...raw };
      for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
      return db;
    }
  } catch (err) {
    console.error('[store] could not read data file, starting fresh:', err.message);
  }
  db = seedFn ? seedFn(emptyDb()) : emptyDb();
  persistNow();
  return db;
}

export function getDb() {
  if (!db) loadDb();
  return db;
}

export function persistNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 0));
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[store] write failed:', err.message);
  }
  // Mirror mutations into Supabase when it is configured and reachable.
  flushSupabase().catch((err) => console.error('[store] supabase flush failed:', err.message));
}

/** Debounced persistence — API handlers can mutate freely. */
export function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    persistNow();
  }, 150);
  if (typeof writeTimer.unref === 'function') writeTimer.unref();
}

export const table = (name) => {
  const d = getDb();
  if (!Array.isArray(d[name])) d[name] = [];
  return d[name];
};

export function insert(name, doc) {
  const row = { id: doc.id || newId(), created_at: new Date().toISOString(), ...doc };
  table(name).push(row);
  queueUpsert(name, row);
  persist();
  return row;
}

export function update(name, id, patch) {
  const rows = table(name);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  queueUpsert(name, rows[idx]);
  persist();
  return rows[idx];
}

export function remove(name, predicate) {
  const rows = table(name);
  const dropped = rows.filter(predicate);
  const kept = rows.filter((r) => !predicate(r));
  const removed = rows.length - kept.length;
  const d = getDb();
  d[name] = kept;
  for (const row of dropped) queueDelete(name, row.id);
  persist();
  return removed;
}

/** Replace a whole collection — used when hydrating from Supabase at boot. */
export function replaceCollection(name, rows) {
  const d = getDb();
  d[name] = Array.isArray(rows) ? rows : [];
}

export function find(name, predicate) {
  return table(name).find(predicate);
}

export function filter(name, predicate) {
  return table(name).filter(predicate);
}

export function getSetting(key, fallback = null) {
  const row = find('settings', (s) => s.key === key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  const row = find('settings', (s) => s.key === key);
  if (row) {
    row.value = value;
    persist();
    return row;
  }
  return insert('settings', { key, value });
}
