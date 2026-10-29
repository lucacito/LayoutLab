// tests/catalog-queries.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parseFilters } from '@/lib/catalog/filters';

// @vercel/postgres requires POSTGRES_URL (not DATABASE_URL) to connect.
// Skip the whole suite when that connection string is absent (no real DB wired up).
const hasDb = !!process.env.POSTGRES_URL;

describe.skipIf(!hasDb)('catalog queries (integration — needs a seeded POSTGRES_URL)', () => {
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

  it('listCatalogItems lists a paid pack once and none of its paid-only pages', async () => {
    const f = parseFilters({ type: 'full_landing' });
    const { packs, layouts, total } = await q.listCatalogItems(f);
    for (const p of packs) {
      expect(p.pack.kind).toBe('paid');
      expect(p.pageCount).toBeGreaterThan(0);
    }
    const paidIds = new Set<string>();
    for (const p of packs) for (const l of await q.getLayoutsForPack(p.pack.id)) paidIds.add(l.id);
    for (const l of layouts) {
      const inPacks = await q.getPacksForLayout(l.id);
      // a page still listed on its own is free: it has no paid pack, or also sits in a free pack
      expect(inPacks.length === 0 || inPacks.some((pk) => pk.kind === 'free')).toBe(true);
    }
    expect(total).toBeGreaterThanOrEqual(packs.length + layouts.length);
    expect(total).toBeLessThanOrEqual(await q.countLayouts(f));
  });

  it('listCatalogItems pages across packs then layouts without repeating or losing an item', async () => {
    const f = parseFilters({});
    // Other integration suites insert and delete layouts on this DB while the files run in parallel,
    // so a pass only counts when the total did not move during it; retry a few times.
    for (let attempt = 0; attempt < 5; attempt++) {
      const first = await q.listCatalogItems(f);
      const seen = new Set<string>();
      let stable = true;
      for (let page = 1; page <= Math.ceil(first.total / 24); page++) {
        const r = await q.listCatalogItems({ ...f, page });
        if (r.total !== first.total) { stable = false; break; }
        for (const p of r.packs) seen.add(`p${p.pack.id}`);
        for (const l of r.layouts) seen.add(`l${l.id}`);
        expect(r.packs.length + r.layouts.length).toBeLessThanOrEqual(24);
      }
      if (!stable) continue;
      expect(seen.size).toBe(first.total);
      return;
    }
    throw new Error('the catalog kept changing under the test');
  });
});
