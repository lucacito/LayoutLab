// app/(catalog)/layouts/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getLayoutBySlug, getPacksForLayout } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildLayoutMetadata, productJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { PackCard } from '@/components/PackCard';
import { TrackView } from '@/components/TrackView';
import { Container } from '@/components/ui/Container';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const layout = await getLayoutBySlug(slug);
  if (!layout) return {};
  return buildLayoutMetadata({
    title: layout.seo?.metaTitle ?? layout.title,
    description: layout.seo?.metaDescription ?? layout.description,
    slug: layout.slug,
    ogImage: layout.previewImageKeys[0] ? assetUrl(layout.previewImageKeys[0]) : undefined,
    keywords: layout.seo?.keywords,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
}

export default async function LayoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const layout = await getLayoutBySlug(slug);
  if (!layout) notFound();

  const packs = await getPacksForLayout(layout.id);
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/layouts/${layout.slug}`;
  const cover = layout.previewImageKeys[0] ? assetUrl(layout.previewImageKeys[0]) : undefined;

  return (
    <main className="py-12">
      <Container>
        <TrackView event="product_viewed" props={{ kind: 'layout', slug: layout.slug }} />
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }]} />
        <JsonLd data={productJsonLd({ name: layout.title, description: layout.description, image: cover, url })} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }])} />

        <h1 className="mt-4 text-h2 text-navy">{layout.title}</h1>
        <p className="mt-1 text-muted">{layout.type} · {layout.niche} · {layout.style}</p>
        {layout.description && <p className="mt-3 max-w-2xl text-body text-muted">{layout.description}</p>}

        <div className="mt-6"><ScreenshotGallery keys={layout.previewImageKeys} title={layout.title} /></div>

        {packs.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-section text-navy">Included in these packs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
