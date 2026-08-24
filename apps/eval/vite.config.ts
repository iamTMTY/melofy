import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The UI dev server (5174) proxies /api to the local eval API server (5175).
// The eval API server in turn calls the running Melofy app (default :3009).
export default defineConfig({
  root: 'ui',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./ui', import.meta.url)) },
  },
  server: {
    port: 5174,
    // Never silently hop to another port — 5175 is the API, and a hop there
    // makes the /api proxy loop back into Vite (white screen). Fail loudly instead.
    strictPort: true,
    // Regex (leading ^) so ONLY real API calls (/api/…) are proxied. A bare
    // '/api' prefix also swallows the UI's own `api.ts` module (served at
    // /api.ts) → 404 → blank screen. The trailing slash is load-bearing.
    proxy: { '^/api/': 'http://localhost:5175' },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
