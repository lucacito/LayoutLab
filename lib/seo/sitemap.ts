import type { MetadataRoute } from 'next';
import { AXIS_VALUES } from '@/lib/catalog/filters';

export function sitemapEntries(i: {
  siteUrl: string;
  layouts: { slug: string; publishedAt: Date | null }[];
  packs: { slug: string; createdAt: Date }[];
}): MetadataRoute.Sitemap {
  // Normalize: a trailing slash on siteUrl would produce double slashes (//browse).
  const base = i.siteUrl.replace(/\/+$/, '');
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/license`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.3 },
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
  return [...staticPages, ...taxonomyEntries, ...packEntries, ...layoutEntries];
}
