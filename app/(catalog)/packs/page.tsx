// app/(catalog)/packs/page.tsx — Themes & Packs catalog.
import type { Metadata } from 'next';
import { listPacks } from '@/lib/catalog/queries';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { PackCard } from '@/components/PackCard';
import { Button } from '@/components/ui/Button';
import { JsonLd } from '@/components/JsonLd';
import { itemListJsonLd, collectionPageJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Divi 5 Themes & Packs — Free Multi-Page Website Kits',
  description:
    'Free multi-page Divi 5 theme packs and curated section collections. Every page shares one brand — senior-level copy, validated JSON, commercial license. Launch a whole site in an afternoon, no charge.',
  alternates: { canonical: '/packs' },
};

export default async function PacksPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try {
    packs = await listPacks();
  } catch {
    packs = [];
  }
  const paid = packs.filter((p) => p.kind === 'paid');
  const free = packs.filter((p) => p.kind === 'free');
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/packs`;

  return (
    <main>
      <JsonLd data={collectionPageJsonLd({ name: 'Divi 5 Themes & Packs', description: metadata.description ?? undefined, url })} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Themes & Packs', url }])} />
      {packs.length > 0 && (
        <JsonLd data={itemListJsonLd(packs.map((p) => ({ name: p.title, url: `${site}/packs/${p.slug}` })))} />
      )}

      {/* Hero */}
      <section className="border-b border-border bg-ink text-paper">
        <Container className="py-16 text-center md:py-20">
          <h1 className="mx-auto max-w-3xl text-h1 text-paper">Complete Divi 5 themes &amp; packs — free</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lead text-paper/85">
            Multi-page website themes where every page already speaks the same language, plus curated section
            collections. Swap in your brand and go live — no blank page, no cleanup, no charge.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/browse">Get the free layouts</Button>
          </div>
        </Container>
      </section>

      {paid.length > 0 && (
        <section className="py-16">
          <Container>
            <SectionTitle eyebrow="Themes" title="Multi-page theme packs">
              One brand, every page. Free — grab it with just an email.
            </SectionTitle>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paid.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </Container>
        </section>
      )}

      {free.length > 0 && (
        <section className="border-t border-border bg-mist py-16">
          <Container>
            <SectionTitle eyebrow="Free" title="Free section packs">
              Lead-magnet collections — grab them with just an email.
            </SectionTitle>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {free.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </Container>
        </section>
      )}

      {packs.length === 0 && (
        <section className="py-24">
          <Container>
            <p className="text-center text-body text-muted">No packs published yet — check back soon.</p>
          </Container>
        </section>
      )}
    </main>
  );
}
