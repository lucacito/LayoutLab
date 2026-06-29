// app/(catalog)/packs/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getPackBySlug, getLayoutsForPack } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { LayoutCard } from '@/components/LayoutCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { PackCta } from '@/components/PackCta';
import { TrackView } from '@/components/TrackView';
import { auth } from '@/lib/auth';
import { getUserIdByEmail, getEntitlementsForUser } from '@/lib/account/queries';
import { canDownloadPack } from '@/lib/stripe/entitlements';

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

  const session = await auth();
  const userId = session?.user?.email ? await getUserIdByEmail(session.user.email) : null;
  const entitlements = userId ? await getEntitlementsForUser(userId) : [];
  const entitled = canDownloadPack({ packId: pack.id, userEntitlements: entitlements });

  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/packs/${pack.slug}`;
  const price = pack.kind === 'free' ? 'Free' : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';

  return (
    <main className="py-12">
      <Container>
        <TrackView event="product_viewed" props={{ kind: 'pack', slug: pack.slug }} />
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }]} />
        <JsonLd data={productJsonLd({
          name: pack.title, description: pack.description, image: pack.coverImageKey ? assetUrl(pack.coverImageKey) : undefined, url,
          offer: pack.priceCents != null ? { priceCents: pack.priceCents } : undefined,
        })} />
        <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${site}/layouts/${l.slug}` })))} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }])} />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 text-navy">{pack.title}</h1>
            {pack.description && <p className="mt-2 max-w-2xl text-body text-muted">{pack.description}</p>}
            <p className="mt-1 text-small text-muted">{layouts.length} layouts</p>
          </div>
          <div className="text-right">
            <div className="text-h3 text-action">{price}</div>
            <div className="mt-2">
              <PackCta pack={{ id: pack.id, slug: pack.slug, kind: pack.kind }} entitled={entitled} />
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-section text-navy">What&apos;s inside</h2>
          {layouts.length === 0 ? (
            <p className="text-muted">No layouts in this pack yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
            </div>
          )}
        </section>
      </Container>
    </main>
  );
}
