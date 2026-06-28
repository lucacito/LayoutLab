// tests/catalog-queries.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parseFilters } from '@/lib/catalog/filters';

// @vercel/postgres requires POSTGRES_URL (not DATABASE_URL) to connect.
// Skip the whole suite when that connection string is absent (no real DB wired up).
const hasDb = !!process.env.POSTGRES_URL;

describe.skipIf(!hasDb)('catalog queries (integration — needs a seeded DATABASE_URL)', () => {
  let q: typeof import('@/lib/catalog/queries');

  beforeAll(async () => {
    q = await import('@/lib/catalog/queries');
  });

  it('listLayouts returns only published rows', async () => {
    const rows = await q.listLayouts(parseFilters({}));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.status).toBe('published');
  });

  it('narrows by a facet', async () => {
    const all = await q.listLayouts(parseFilters({}));
    const heroes = await q.listLayouts(parseFilters({ type: 'hero' }));
    expect(heroes.length).toBeLessThanOrEqual(all.length);
    for (const r of heroes) expect(r.type).toBe('hero');
  });

  it('getLayoutBySlug returns null for an unknown slug', async () => {
    expect(await q.getLayoutBySlug('does-not-exist')).toBeNull();
  });

  it('facetCounts reports counts per axis value', async () => {
    const counts = await q.facetCounts();
    expect(Object.values(counts.type).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
