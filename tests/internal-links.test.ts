import { describe, it, expect } from 'vitest';
import { hubLinkGroups } from '@/lib/seo/internal-links';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { getKeywordPage } from '@/lib/seo/keyword-pages';

describe('hubLinkGroups', () => {
  const groups = hubLinkGroups();

  it('returns the type, niche and collection hub groups (styles dropped from nav)', () => {
    expect(groups.map((g) => g.heading)).toEqual(['Layouts/Sections', 'Industries', 'Collections & Guides']);
  });

  it('builds taxonomy hrefs on the correct axis path, only for real AXIS_VALUES', () => {
    for (const g of groups.filter((g) => g.axis === 'type' || g.axis === 'niche')) {
      const axis = g.axis as 'type' | 'niche';
      for (const l of g.links) {
        expect(l.href.startsWith(`/${axis}/`)).toBe(true);
        const value = l.href.split('/').pop() as string;
        expect((AXIS_VALUES[axis] as readonly string[]).includes(value)).toBe(true);
        expect(l.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('collection links resolve to keyword pages or the guides index', () => {
    const collection = groups.find((g) => g.axis === 'collection');
    expect(collection).toBeDefined();
    for (const l of collection!.links) {
      const slug = l.href.replace(/^\//, '');
      const ok = slug === 'guides' || Boolean(getKeywordPage(slug));
      expect(ok, l.href).toBe(true);
    }
  });

  it('humanizes acronym values via axisLabel', () => {
    const faq = groups[0].links.find((l) => l.href === '/type/faq');
    expect(faq?.label).toBe('FAQ');
    const saas = groups[1].links.find((l) => l.href === '/niche/saas');
    expect(saas?.label).toBe('SaaS');
  });
});
