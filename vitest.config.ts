// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // .test.tsx files render React components → run them under jsdom.
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
    globals: true,
    // Minimal env so `lib/env.ts`'s eager singleton parses on import during tests
    // (mirrors the vars CI injects in .github/workflows/ci.yml).
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://layoutlab.com',
      DATABASE_URL: 'postgres://u:p@localhost/db',
      AUTH_SECRET: 'test-secret-test-secret-32chars!!',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_ci',
      INGEST_API_TOKEN: 'test-ingest-token',
      ADMIN_EMAILS: 'admin@layoutlab.com',
    },
  },
});
