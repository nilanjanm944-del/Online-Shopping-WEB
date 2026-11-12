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
