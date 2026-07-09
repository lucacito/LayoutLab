import { describe, expect, it } from 'vitest';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { listKeywordPages } from '@/lib/seo/keyword-pages';

describe('sitemap keyword entries', () => {
  it('includes every keyword landing page at priority 0.8', () => {
    const entries = sitemapEntries({ siteUrl: 'https://divi5lab.com', layouts: [], packs: [] });
    const urls = new Map(entries.map((e) => [e.url, e]));
    for (const p of listKeywordPages()) {
      const entry = urls.get(`https://divi5lab.com/${p.slug}`);
      expect(entry, p.slug).toBeDefined();
      expect(entry?.priority).toBe(0.8);
    }
  });
});
