import { describe, it, expect } from 'vitest';
import { buildSeedData } from '@/db/seed';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('buildSeedData', () => {
  const data = buildSeedData();

  it('produces at least 12 published layouts with valid facet values', () => {
    expect(data.layouts.length).toBeGreaterThanOrEqual(12);
    for (const l of data.layouts) {
      expect(l.status).toBe('published');
      expect(l.validatorPassed).toBe(true);
      expect(AXIS_VALUES.type).toContain(l.type);
      expect((l.previewImageKeys ?? []).length).toBeGreaterThan(0);
    }
  });

  it('produces exactly one free pack and at least one paid pack', () => {
    expect(data.packs.filter((p) => p.kind === 'free')).toHaveLength(1);
    expect(data.packs.filter((p) => p.kind === 'paid').length).toBeGreaterThanOrEqual(1);
    for (const p of data.packs) expect(p.status).toBe('published');
  });

  it('has unique layout and pack slugs', () => {
    const ls = data.layouts.map((l) => l.slug);
    const ps = data.packs.map((p) => p.slug);
    expect(new Set(ls).size).toBe(ls.length);
    expect(new Set(ps).size).toBe(ps.length);
  });

  it('only references real layout/pack ids in join rows', () => {
    const layoutIds = new Set(data.layouts.map((l) => l.id));
    const packIds = new Set(data.packs.map((p) => p.id));
    for (const pl of data.packLayouts) {
      expect(packIds.has(pl.packId)).toBe(true);
      expect(layoutIds.has(pl.layoutId)).toBe(true);
    }
  });
});
