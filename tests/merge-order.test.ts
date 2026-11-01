import { describe, it, expect } from 'vitest';
import { mergeCatalogOrder, type OrderKey } from '@/lib/catalog/merge-order';

const k = (id: string, day: number, title = id): OrderKey => ({ id, createdAt: new Date(Date.UTC(2026, 10, day)), title });

describe('mergeCatalogOrder', () => {
  it('puts a newer layout above an older pack (newest first)', () => {
    const packs = [k('kiln', 28), k('folio', 20)];
    const layouts = [k('landing-b', 31), k('landing-a', 30), k('old-free', 10)];
    expect(mergeCatalogOrder(packs, layouts, 'newest').map((r) => r.id))
      .toEqual(['landing-b', 'landing-a', 'kiln', 'folio', 'old-free']);
  });

  it('oldest first reverses the comparison', () => {
    const packs = [k('p1', 5), k('p2', 20)];
    const layouts = [k('l1', 1), k('l2', 10)];
    expect(mergeCatalogOrder(packs, layouts, 'oldest').map((r) => r.id)).toEqual(['l1', 'p1', 'l2', 'p2']);
  });

  it('title sort interleaves by title', () => {
    expect(mergeCatalogOrder([k('p', 1, 'Beta')], [k('a', 1, 'Alpha'), k('c', 1, 'Gamma')], 'title').map((r) => r.id))
      .toEqual(['a', 'p', 'c']);
  });

  it('a tie goes to the pack, and nothing is lost or repeated', () => {
    const out = mergeCatalogOrder([k('p', 3)], [k('l', 3), k('m', 3)], 'newest');
    expect(out.map((r) => `${r.kind}:${r.id}`)).toEqual(['pack:p', 'layout:l', 'layout:m']);
    expect(mergeCatalogOrder([], [], 'newest')).toEqual([]);
  });
});
