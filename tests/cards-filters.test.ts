import { describe, it, expect } from 'vitest';
import { parseFilters, AXIS_VALUES } from '@/lib/catalog/filters';
import { buildLayoutFilters } from '@/lib/catalog/query-builder';

describe('cards filters', () => {
  it('lists cards as a type and 2/3/4 as columns axis values', () => {
    expect(AXIS_VALUES.type).toContain('cards');
    expect(AXIS_VALUES.columns).toEqual(['2', '3', '4']);
  });

  it('parses the columns query param against the allowed set', () => {
    const f = parseFilters({ type: 'cards', columns: '3,4,99' });
    expect(f.type).toEqual(['cards']);
    expect(f.columns).toEqual(['3', '4']); // 99 rejected
  });

  it('adds a SQL condition when columns are selected', () => {
    const withCols = buildLayoutFilters(parseFilters({ columns: '3' }));
    const without = buildLayoutFilters(parseFilters({}));
    expect(withCols.conditions.length).toBe(without.conditions.length + 1);
  });
});
