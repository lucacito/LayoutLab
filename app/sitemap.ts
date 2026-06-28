import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { listAllPublishedLayoutSlugs, listAllPublishedPackSlugs } from '@/lib/catalog/queries';

// Sitemap rows come from the live DB; render on-demand instead of
// prerendering at build time (which would fail without a real connection).
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [layouts, packs] = await Promise.all([
    listAllPublishedLayoutSlugs(),
    listAllPublishedPackSlugs(),
  ]);
  return sitemapEntries({ siteUrl: env.NEXT_PUBLIC_SITE_URL, layouts, packs });
}
