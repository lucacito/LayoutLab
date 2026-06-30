import { describe, it, expect } from 'vitest';
import { parseFilters, PAGE_SIZE } from '@/lib/catalog/filters';
import { buildLayoutFilters } from '@/lib/catalog/query-builder';

describe('parseFilters', () => {
  it('defaults to empty facets, newest sort, page 1', () => {
    const f = parseFilters({});
    expect(f).toEqual({ type: [], niche: [], style: [], color: [], columns: [], q: undefined, sort: 'newest', page: 1 });
  });

  it('parses comma-separated axis values and keeps only known ones', () => {
    const f = parseFilters({ type: 'hero,pricing,bogus', niche: 'saas' });
    expect(f.type).toEqual(['hero', 'pricing']);
    expect(f.niche).toEqual(['saas']);
  });

  it('accepts repeated params as arrays', () => {
    const f = parseFilters({ style: ['minimal', 'dark'] });
    expect(f.style).toEqual(['minimal', 'dark']);
  });

  it('clamps an unknown sort to newest and a bad page to 1', () => {
    expect(parseFilters({ sort: 'wat' }).sort).toBe('newest');
    expect(parseFilters({ page: '0' }).page).toBe(1);
    expect(parseFilters({ page: 'abc' }).page).toBe(1);
    expect(parseFilters({ page: '3' }).page).toBe(3);
  });

  it('trims search text and drops empty', () => {
    expect(parseFilters({ q: '  hero  ' }).q).toBe('hero');
    expect(parseFilters({ q: '   ' }).q).toBeUndefined();
  });
});

describe('buildLayoutFilters', () => {
  it('always includes the published-status condition', () => {
    const { conditions } = buildLayoutFilters(parseFilters({}));
    expect(conditions.length).toBe(1); // status only
  });

  it('adds one condition per active facet plus search', () => {
    const f = parseFilters({ type: 'hero', niche: 'saas', style: 'dark', color: 'blue', q: 'bold' });
    const { conditions } = buildLayoutFilters(f);
    expect(conditions.length).toBe(6); // status + 4 facets + search
  });

  it('computes pagination from page and PAGE_SIZE', () => {
    const { limit, offset } = buildLayoutFilters(parseFilters({ page: '3' }));
    expect(limit).toBe(PAGE_SIZE);
    expect(offset).toBe(2 * PAGE_SIZE);
  });
});
