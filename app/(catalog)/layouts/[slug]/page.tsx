// app/(catalog)/layouts/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getLayoutBySlug, getPacksForLayout, listRelatedLayouts, listVariantSiblings } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildLayoutMetadata, productJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { LayoutArticle, SHARED_LAYOUT_FAQ } from '@/components/LayoutArticle';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { ResponsivePreview } from '@/components/ResponsivePreview';
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
import { RequiresWooBadge } from '@/components/RequiresWooBadge';
import { VariantSwitcher } from '@/components/VariantSwitcher';
import { StarRating } from '@/components/ratings/StarRating';
import { Stars } from '@/components/ratings/Stars';
import { RewardsProgress } from '@/components/rewards/RewardsProgress';
import { ratingAverage } from '@/lib/ratings/compute';
import { layoutAltText } from '@/lib/seo/alt-text';

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
  const siblings = layout.variant?.group ? await listVariantSiblings(layout.variant.group) : [];
  const [captureEmail, session] = await Promise.all([readCaptureEmail(), auth()]);
  const captured = Boolean(captureEmail || session?.user);
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/layouts/${layout.slug}`;
  const cover = layout.previewImageKeys[0] ? assetUrl(layout.previewImageKeys[0]) : undefined;
  const ratingAvg = ratingAverage(layout.ratingSum, layout.ratingCount);
  const altBase = layoutAltText(layout);
  // Screenshots as captioned ImageObjects (Google Images + product rich results).
  const productImages = layout.previewImageKeys.map((k) => ({
    url: assetUrl(k),
    caption: /-mobile\./.test(k) ? `${altBase} — mobile screenshot` : `${altBase} — desktop screenshot`,
  }));
  const article = layout.seo?.article;

  return (
    <main className="py-12">
      <Container>
        <TrackView event="product_viewed" props={{ kind: 'layout', slug: layout.slug }} />
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }]} />
        <JsonLd data={productJsonLd({
          name: layout.title, description: layout.description, image: cover, images: productImages, url,
          // Layouts are free — a $0.00 Offer satisfies Google's "offers required" rule.
          offer: { priceCents: 0 },
          // Real ratings only (helper drops it when ratingCount === 0).
          aggregateRating: { ratingValue: ratingAvg, ratingCount: layout.ratingCount },
        })} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }])} />
        {article && (
          <JsonLd data={faqJsonLd([...article.faq, ...SHARED_LAYOUT_FAQ].map((f) => ({ question: f.q, answer: f.a })))} />
        )}

        <h1 className="mt-4 text-h2 text-navy">{layout.title}</h1>
        {layout.type === 'shop' && <RequiresWooBadge />}
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
        {layout.ratingCount > 0 && <Stars average={ratingAvg} count={layout.ratingCount} className="mt-3" />}
        {layout.description && <p className="mt-4 max-w-2xl text-body text-muted">{layout.description}</p>}

        <VariantSwitcher current={layout} siblings={siblings} />

        <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-small font-semibold uppercase tracking-wide text-muted">Rate this element</p>
            <div className="mt-2">
              <StarRating layoutId={layout.id} slug={layout.slug} initialAverage={ratingAvg} initialCount={layout.ratingCount} />
            </div>
          </div>
          <RewardsProgress className="w-full sm:w-80" />
        </Card>

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

        <div className="mt-6"><ResponsivePreview keys={layout.previewImageKeys} title={layout.title} altBase={altBase} type={layout.type} color={layout.colors?.[0]} layoutStyle={layout.style} /></div>

        <LayoutArticle title={layout.title} article={article} />

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
