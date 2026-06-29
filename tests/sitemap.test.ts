import { describe, it, expect } from 'vitest';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { AXIS_VALUES } from '@/lib/catalog/filters';

const SITE = 'https://layoutlab.com';

describe('sitemapEntries', () => {
  const out = sitemapEntries({
    siteUrl: SITE,
    layouts: [{ slug: 'a', publishedAt: new Date('2026-01-01') }, { slug: 'b', publishedAt: null }],
    packs: [{ slug: 'p1', createdAt: new Date('2026-02-01') }],
  });

  it('includes static marketing pages', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}`);
    expect(urls).toContain(`${SITE}/browse`);
    expect(urls).toContain(`${SITE}/pricing`);
  });

  it('includes every layout and pack url', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}/layouts/a`);
    expect(urls).toContain(`${SITE}/layouts/b`);
    expect(urls).toContain(`${SITE}/packs/p1`);
  });

  it('includes a URL for every taxonomy axis value', () => {
    const urls = out.map((e) => e.url);
    for (const axis of ['type', 'niche', 'style', 'color'] as const) {
      for (const value of AXIS_VALUES[axis]) {
        expect(urls).toContain(`${SITE}/${axis}/${value}`);
      }
    }
  });

  it('still includes the static + browse pages', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}`);
    expect(urls).toContain(`${SITE}/browse`);
  });
});
