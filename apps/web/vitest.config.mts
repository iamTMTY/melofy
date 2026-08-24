import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node', // pure logic — no DOM, no model/DB/Redis
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': src,
      // `server-only` is a transitive import in the translation module chain;
      // it's a browser-bundle guard with no meaning in Node tests.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
});
