import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { listAllPublishedLayoutSlugs, listAllPublishedPackSlugs } from '@/lib/catalog/queries';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [layouts, packs] = await Promise.all([
    listAllPublishedLayoutSlugs(),
    listAllPublishedPackSlugs(),
  ]);
  return sitemapEntries({ siteUrl: env.NEXT_PUBLIC_SITE_URL, layouts, packs });
}
