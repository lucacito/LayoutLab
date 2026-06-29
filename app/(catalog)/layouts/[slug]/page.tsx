// app/(catalog)/layouts/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getLayoutBySlug, getPacksForLayout, listRelatedLayouts } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildLayoutMetadata, productJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { PackCard } from '@/components/PackCard';
import { TrackView } from '@/components/TrackView';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { readCaptureEmail } from '@/lib/capture/cookie';
import { auth } from '@/lib/auth';
import { FreeDownloadGate } from '@/components/FreeDownloadGate';
import { BookmarkButton } from '@/components/bookmarks/BookmarkButton';
import { RelatedElements } from '@/components/RelatedElements';

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
  const related = await listRelatedLayouts(layout.type, layout.id, 6);
  const [captureEmail, session] = await Promise.all([readCaptureEmail(), auth()]);
  const captured = Boolean(captureEmail || session?.user);
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
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { axis: 'type', value: layout.type },
            { axis: 'niche', value: layout.niche },
            { axis: 'style', value: layout.style },
          ]
            .filter((c): c is { axis: string; value: string } => Boolean(c.value))
            .map((c) => (
              <Link key={c.axis} href={`/${c.axis}/${c.value}`} className="rounded-full bg-mist px-3 py-1 text-small font-medium text-navy transition hover:bg-fog">
                {axisLabel(c.value)}
              </Link>
            ))}
        </div>
        {layout.description && <p className="mt-4 max-w-2xl text-body text-muted">{layout.description}</p>}

        <Card className="mt-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-section text-navy">Download this section — free</h2>
            <ul className="mt-3 space-y-1.5 text-small text-muted">
              {['Divi 5 JSON — import in seconds', 'Commercial license included', 'No account needed'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-action" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <BookmarkButton slug={layout.slug} />
            <FreeDownloadGate layoutId={layout.id} slug={layout.slug} captured={captured} />
          </div>
        </Card>

        <div className="mt-6"><ScreenshotGallery keys={layout.previewImageKeys} title={layout.title} type={layout.type} color={layout.colors?.[0]} layoutStyle={layout.style} /></div>

        {packs.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-section text-navy">Included in these packs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </section>
        )}

        <RelatedElements type={layout.type} currentStyle={layout.style} related={related} />
      </Container>
    </main>
  );
}
