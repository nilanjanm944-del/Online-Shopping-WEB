import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Express server (server/index.js) serves the built client from dist/
// and exposes the JSON API under /api. During local development Vite proxies
// /api to the API server so a single `npm run dev` + `npm run dev:api` pair works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
