import { describe, it, expect } from 'vitest';
import { AXIS_VALUES, parseFilters } from '@/lib/catalog/filters';
import { AXIS_META } from '@/lib/nav/menu-data';
import { skeletonForType } from '@/lib/preview/skin';

describe('shop type wiring', () => {
  it('is an allowed type axis value', () => {
    expect(AXIS_VALUES.type).toContain('shop');
  });

  it('survives parseFilters as a type facet', () => {
    const f = parseFilters({ type: 'shop' });
    expect(f.type).toEqual(['shop']);
  });

  it('has nav metadata (icon + blurb)', () => {
    expect(AXIS_META.type.shop).toBeDefined();
    expect(AXIS_META.type.shop.icon).toBeTruthy();
    expect(AXIS_META.type.shop.blurb).toBeTruthy();
  });

  it('maps to the grid preview archetype', () => {
    expect(skeletonForType('shop')).toBe('grid');
  });
});
