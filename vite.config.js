import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Express server (server/index.js) serves the built client from dist/ and
// exposes the JSON API under /api. During local development Vite proxies /api to
// the API server, so `npm run dev` + `npm run dev:api` work together.
//
// GitHub Pages serves the app from a sub-path (/<repository>/), so the base path
// is configurable at build time. The default '/' keeps the Express and Docker
// build unchanged.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
