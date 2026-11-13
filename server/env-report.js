/**
 * Environment diagnostics — presence only, never values.
 *
 * The deployed container has been reporting `configured:false` even though the
 * platform stores SUPABASE_URL / SUPABASE_ANON_KEY. To tell "the variable is
 * missing" apart from "the variable never reaches the runtime", the build stage
 * records which names it could see (build-env.json, booleans only) and the
 * running server reports what it can see at request time. Comparing the two
 * shows whether the gap is in the build or in the container environment.
 *
 * No key material, URL or secret value is ever written or returned here.
 */

import { readFileSync } from 'node:fs';

/** Names that matter for storage, payments and sessions. */
const WATCHED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'JWT_SECRET',
  'NODE_ENV',
  'PORT',
];

const presenceOf = (env) =>
  Object.fromEntries(WATCHED.map((name) => [name, Boolean(env[name])]));

/** What the running process can see right now. */
export function runtimeEnvPresence() {
  return {
    ...presenceOf(process.env),
    keyCount: Object.keys(process.env).length,
  };
}

/** What the build stage could see (written by scripts/capture-build-env.mjs). */
export function buildEnvSnapshot() {
  try {
    const raw = readFileSync(new URL('../build-env.json', import.meta.url), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      capturedAt: parsed.capturedAt || null,
      presence: parsed.presence || null,
      keyCount: typeof parsed.keyCount === 'number' ? parsed.keyCount : null,
    };
  } catch {
    return null;
  }
}
