import { describe, it, expect } from 'vitest';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { PLUGIN_MENU } from '@/lib/nav/menu-data';

const SITE = 'https://divi5lab.com';

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

  it('includes the primary /packs and /contact sections', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}/packs`);
    expect(urls).toContain(`${SITE}/contact`);
  });

  it('includes the /plugins hub and every product page the nav lists', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}/plugins`);
    // Derived from PLUGIN_MENU so a new converter can never be left out of the
    // sitemap the way Beaver Builder and WPBakery were.
    for (const item of PLUGIN_MENU) {
      expect(urls).toContain(`${SITE}${item.href}`);
    }
    expect(urls).toContain(`${SITE}/plugins/beaver-builder-to-divi-5`);
    expect(urls).toContain(`${SITE}/plugins/wpbakery-to-divi-5`);
  });

  it('ranks the converters above the AI editor and lists each plugin once', () => {
    const plugins = out.filter((e) => e.url.startsWith(`${SITE}/plugins/`));
    expect(plugins).toHaveLength(PLUGIN_MENU.length);
    expect(new Set(plugins.map((e) => e.url)).size).toBe(PLUGIN_MENU.length);
    const priority = (href: string) => plugins.find((e) => e.url === `${SITE}${href}`)?.priority;
    expect(priority('/plugins/wpbakery-to-divi-5')).toBe(0.9);
    expect(priority('/plugins/beaver-builder-to-divi-5')).toBe(0.9);
    expect(priority('/plugins/divi-5-ai-editor')).toBe(0.6);
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
