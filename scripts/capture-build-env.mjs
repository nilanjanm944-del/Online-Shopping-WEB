/**
 * Runs before `vite build` (npm prebuild) inside the image build stage.
 *
 * Records which environment variable names exist at build time — booleans and a
 * count only, never values. The server compares this with its runtime
 * environment so a "connected but unused" integration can be traced to either
 * the build stage or the container runtime.
 */

import { writeFileSync } from 'node:fs';

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

const presence = Object.fromEntries(WATCHED.map((name) => [name, Boolean(process.env[name])]));

writeFileSync(
  'build-env.json',
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      presence,
      keyCount: Object.keys(process.env).length,
    },
    null,
    2
  )
);

console.log('[capture-build-env] presence:', JSON.stringify(presence));
