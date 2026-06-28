// app/(catalog)/packs/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getPackBySlug, getLayoutsForPack } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { LayoutCard } from '@/components/LayoutCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) return {};
  return buildPackMetadata({
    title: pack.seo?.metaTitle ?? pack.title,
    description: pack.seo?.metaDescription ?? pack.description,
    slug: pack.slug,
    ogImage: pack.coverImageKey ? assetUrl(pack.coverImageKey) : undefined,
    keywords: pack.seo?.keywords,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const layouts = await getLayoutsForPack(pack.id);
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/packs/${pack.slug}`;
  const price = pack.kind === 'free' ? 'Free' : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }]} />
      <JsonLd data={productJsonLd({
        name: pack.title, description: pack.description, image: pack.coverImageKey ? assetUrl(pack.coverImageKey) : undefined, url,
        offer: pack.priceCents != null ? { priceCents: pack.priceCents } : undefined,
      })} />
      <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${site}/layouts/${l.slug}` })))} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }])} />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{pack.title}</h1>
          {pack.description && <p className="mt-2 max-w-2xl text-gray-700">{pack.description}</p>}
          <p className="mt-1 text-sm text-gray-500">{layouts.length} layouts</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{price}</div>
          {/* Commerce is Phase 4 — CTA is a stub link to pricing. */}
          <Link href="/pricing" className="mt-2 inline-block rounded bg-black px-4 py-2 text-sm text-white">
            {pack.kind === 'free' ? 'Get this pack' : 'Buy this pack'}
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">What&apos;s inside</h2>
        {layouts.length === 0 ? (
          <p className="text-gray-500">No layouts in this pack yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
          </div>
        )}
      </section>
    </main>
  );
}
