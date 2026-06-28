import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Minimal env so `lib/env.ts`'s eager singleton parses on import during tests
    // (mirrors the vars CI injects in .github/workflows/ci.yml).
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://layoutlab.com',
      DATABASE_URL: 'postgres://u:p@localhost/db',
      AUTH_SECRET: 'test-secret-test-secret-32chars!!',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_ci',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
