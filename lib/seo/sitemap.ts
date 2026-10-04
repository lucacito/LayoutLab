import type { MetadataRoute } from 'next';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { listKeywordPages } from '@/lib/seo/keyword-pages';
import { listGuides } from '@/lib/guides';
import { PLUGIN_MENU } from '@/lib/nav/menu-data';

// The pages whose content changed with the shift to the AI Editor as the lead product; Google uses lastmod as a hint to recrawl.
const SHIFT_DATE = new Date('2026-10-04');

export function sitemapEntries(i: {
  siteUrl: string;
  layouts: { slug: string; publishedAt: Date | null }[];
  packs: { slug: string; createdAt: Date }[];
}): MetadataRoute.Sitemap {
  // Normalize: a trailing slash on siteUrl would produce double slashes (//browse).
  const base = i.siteUrl.replace(/\/+$/, '');
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: SHIFT_DATE, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/browse`, changeFrequency: 'daily', priority: 0.9 },
    // /packs is a primary nav section (Themes & Packs). It was previously
    // omitted from the sitemap, hiding a top-level section from Google.
    { url: `${base}/packs`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: SHIFT_DATE, changeFrequency: 'weekly', priority: 0.9 },
    // WordPress plugins section: the hub, plus one entry per product derived
    // from PLUGIN_MENU below, so adding a converter never leaves it out of the
    // sitemap (Beaver Builder and WPBakery were missing until 2026-09-11).
    { url: `${base}/plugins`, lastModified: SHIFT_DATE, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: SHIFT_DATE, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/license`, lastModified: SHIFT_DATE, changeFrequency: 'yearly', priority: 0.3 },
  ];
  // One entry per plugin page, from the same list the nav renders. The AI Editor is the lead product; the converters
  // are secondary money pages.
  const pluginEntries: MetadataRoute.Sitemap = PLUGIN_MENU.map((p) => {
    const lead = p.href === '/plugins/divi-5-ai-editor';
    return {
      url: `${base}${p.href}`,
      ...(lead ? { lastModified: SHIFT_DATE } : {}),
      changeFrequency: 'weekly' as const,
      priority: lead ? 0.95 : 0.7,
    };
  });
  // Broad-keyword landing pages (/divi-layouts, /divi-templates, …): money
  // pages for head terms, prioritized just under /browse.
  const keywordEntries: MetadataRoute.Sitemap = listKeywordPages().map((p) => ({
    url: `${base}/${p.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  const guideEntries: MetadataRoute.Sitemap = [
    { url: `${base}/guides`, changeFrequency: 'weekly' as const, priority: 0.7 },
    ...listGuides().map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: new Date(g.updated ?? g.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
  const taxonomyEntries: MetadataRoute.Sitemap = (['type', 'niche', 'style', 'color'] as const).flatMap((axis) =>
    AXIS_VALUES[axis].map((value) => ({
      url: `${base}/${axis}/${value}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  );
  const packEntries: MetadataRoute.Sitemap = i.packs.map((p) => ({
    url: `${base}/packs/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  const layoutEntries: MetadataRoute.Sitemap = i.layouts.map((l) => ({
    url: `${base}/layouts/${l.slug}`,
    lastModified: l.publishedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...pluginEntries, ...keywordEntries, ...guideEntries, ...taxonomyEntries, ...packEntries, ...layoutEntries];
}
