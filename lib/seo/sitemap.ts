import type { MetadataRoute } from 'next';

export function sitemapEntries(i: {
  siteUrl: string;
  layouts: { slug: string; publishedAt: Date | null }[];
  packs: { slug: string; createdAt: Date }[];
}): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: i.siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${i.siteUrl}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${i.siteUrl}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${i.siteUrl}/license`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${i.siteUrl}/about`, changeFrequency: 'yearly', priority: 0.3 },
  ];
  const packEntries: MetadataRoute.Sitemap = i.packs.map((p) => ({
    url: `${i.siteUrl}/packs/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  const layoutEntries: MetadataRoute.Sitemap = i.layouts.map((l) => ({
    url: `${i.siteUrl}/layouts/${l.slug}`,
    lastModified: l.publishedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...packEntries, ...layoutEntries];
}
