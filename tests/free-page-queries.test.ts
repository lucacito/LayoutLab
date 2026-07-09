import { describe, it, expect, beforeAll } from 'vitest';

// Same integration pattern as catalog-queries.test.ts — needs a seeded DB.
const hasDb = !!process.env.POSTGRES_URL;

describe.skipIf(!hasDb)('listFreeLayouts (integration — needs a seeded POSTGRES_URL)', () => {
  let q: typeof import('@/lib/catalog/queries');

  beforeAll(async () => {
    q = await import('@/lib/catalog/queries');
  });

  it('returns only published layouts that are not paid-only', async () => {
    const rows = await q.listFreeLayouts(100);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows.slice(0, 10)) {
      expect(r.status).toBe('published');
      const packs = await q.getPacksForLayout(r.id);
      const paidOnly = packs.length > 0 && packs.every((p) => p.kind === 'paid');
      expect(paidOnly, `${r.slug} should not be paid-only`).toBe(false);
    }
  });

  it('respects the limit', async () => {
    const rows = await q.listFreeLayouts(3);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});
