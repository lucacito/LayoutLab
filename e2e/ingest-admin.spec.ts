// e2e/ingest-admin.spec.ts
import { test, expect } from '@playwright/test';

// Requires a seeded DB + the ingest token. Skips otherwise.
test.skip(!process.env.POSTGRES_URL || !process.env.INGEST_API_TOKEN, 'needs POSTGRES_URL + INGEST_API_TOKEN');

const TOKEN = process.env.INGEST_API_TOKEN!;

test('ingest is idempotent and a pending layout is not publicly visible', async ({ request }) => {
  const stamp = Date.now();
  const slug = `e2e-ingest-${stamp}`;
  const payload = {
    slug, title: `E2E Ingest ${stamp}`, type: 'hero', niche: 'saas', style: 'minimal',
    colors: ['blue'], diviJsonBlobKey: `layouts/${slug}.json`,
    previewImageKeys: ['https://picsum.photos/seed/e2e/1200/900'],
    contentHash: `e2e-${stamp}`, validatorPassed: true,
  };

  // First POST creates a pending layout; a repeat dedupes.
  const first = await request.post('/api/ingest', { headers: { authorization: `Bearer ${TOKEN}` }, data: payload });
  expect(first.status()).toBe(201);
  expect((await first.json()).status).toBe('pending');

  const second = await request.post('/api/ingest', { headers: { authorization: `Bearer ${TOKEN}` }, data: payload });
  expect(second.status()).toBe(200);
  expect((await second.json()).deduped).toBe(true);

  // A wrong token is rejected.
  const noAuth = await request.post('/api/ingest', { data: payload });
  expect(noAuth.status()).toBe(401);

  // While pending, the public detail route 404s (published-only catalog).
  const detail = await request.get(`/layouts/${slug}`);
  expect(detail.status()).toBe(404);
});
