/**
 * ZYREX STORE — application server.
 *
 * One Express process serves the JSON API under /api, generated artwork under
 * /api/img, uploaded product images under /api/uploads and the built React
 * single-page app for every other route (so deep links survive a refresh).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadDb } from './store.js';
import { seedDatabase } from './seed.js';
import { artworkRoute } from './images.js';
import authRoutes from './routes/auth.js';
import catalogueRoutes from './routes/catalogue.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;

// Initialise the datastore (seeds the demo catalogue on first boot).
loadDb(seedDatabase);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// --- CORS for a separately hosted client (for example GitHub Pages) --------
// The React build may be served from another origin. Only allowlisted origins
// may call the API with credentials, and state-changing requests arriving from
// an unexpected origin are rejected, so the session cookie cannot be reused for
// cross-site requests. Same-origin calls are always permitted.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://nilanjanm944-del.github.io')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isLocalOrigin = (origin) =>
  process.env.NODE_ENV !== 'production' &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');

const isSameOrigin = (req, origin) => {
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const crossOriginTrusted =
    Boolean(origin) &&
    !isSameOrigin(req, origin) &&
    (ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, '')) || isLocalOrigin(origin));

  if (crossOriginTrusted) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();

  const safeMethod = req.method === 'GET' || req.method === 'HEAD';
  if (origin && !safeMethod && !crossOriginTrusted && !isSameOrigin(req, origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  return next();
});

// Generated demo artwork (original SVGs, cached for a week).
app.get('/api/img/:kind/:seed', artworkRoute);

// Uploaded product images.
const uploadsDir = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'), 'uploads');
app.use('/api/uploads', express.static(uploadsDir, { maxAge: '7d', fallthrough: true }));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'zyrex-store', time: new Date().toISOString(), uptime: Math.round(process.uptime()) })
);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', cartRoutes);
app.use('/api', catalogueRoutes);
app.use('/api', orderRoutes);
app.use('/api', contentRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Static client build + SPA fallback.
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .type('html')
      .send('<h1>ZYREX STORE API</h1><p>The client build is missing. Run <code>npm run build</code>.</p>')
  );
}

// Central error handler: never leak stack traces to clients.
app.use((err, req, res, _next) => {
  console.error('[server]', err?.message || err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[zyrex] listening on http://0.0.0.0:${PORT}`);
});
