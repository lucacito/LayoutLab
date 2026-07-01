import { describe, it, expect } from 'vitest';
import { hubLinkGroups } from '@/lib/seo/internal-links';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('hubLinkGroups', () => {
  const groups = hubLinkGroups();

  it('returns the type, niche and style hub groups', () => {
    expect(groups.map((g) => g.heading)).toEqual(['Layout types', 'Industries', 'Styles']);
  });

  it('builds hrefs on the correct axis path, only for real AXIS_VALUES', () => {
    for (const g of groups) {
      for (const l of g.links) {
        expect(l.href.startsWith(`/${g.axis}/`)).toBe(true);
        const value = l.href.split('/').pop() as string;
        expect((AXIS_VALUES[g.axis] as readonly string[]).includes(value)).toBe(true);
        expect(l.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('humanizes acronym values via axisLabel', () => {
    const faq = groups[0].links.find((l) => l.href === '/type/faq');
    expect(faq?.label).toBe('FAQ');
    const saas = groups[1].links.find((l) => l.href === '/niche/saas');
    expect(saas?.label).toBe('SaaS');
  });
});
