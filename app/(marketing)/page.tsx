// app/(marketing)/page.tsx
import Image from 'next/image';
import { listPacks, listLayouts } from '@/lib/catalog/queries';
import { parseFilters } from '@/lib/catalog/filters';
import { assetUrl } from '@/lib/blob/url';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconFeature } from '@/components/ui/IconFeature';
import { GradientBlob } from '@/components/ui/GradientBlob';
import { PackCard } from '@/components/PackCard';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { title: 'Validated, every time', body: 'Each layout passes a deterministic Divi 5 validator before it reaches the catalog.' },
  { title: 'Import-ready JSON', body: 'Download the layout and import it straight into Divi 5 — no cleanup.' },
  { title: 'Browse by everything', body: 'Filter by type, industry, style and color to find the right starting point fast.' },
];

export default async function HomePage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try {
    packs = (await listPacks()).slice(0, 3);
  } catch {
    packs = [];
  }

  let heroImageUrl: string | null = null;
  try {
    const heroLayouts = await listLayouts(parseFilters({}));
    const first = heroLayouts.find((l) => l.previewImageKeys && l.previewImageKeys.length > 0);
    if (first?.previewImageKeys?.[0]) {
      heroImageUrl = assetUrl(first.previewImageKeys[0]);
    }
  } catch {
    heroImageUrl = null;
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <GradientBlob className="left-1/2 top-[-10%] h-[480px] w-[480px]" />
        <Container className="grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div>
            <h1 className="text-h1 text-navy">Conversion-ready Divi 5 layouts, validated and ready to import.</h1>
            <p className="mt-6 text-lead text-muted">Stop starting from a blank page. Browse a growing library of validated Divi 5 sections and full pages — download the JSON and import in seconds.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button href="/browse">Browse layouts</Button>
              <Button href="/pricing" variant="secondary">See pricing</Button>
            </div>
          </div>
          <div className="relative">
            <GradientBlob className="right-[-10%] top-[10%] h-[360px] w-[360px]" />
            <Card className="overflow-hidden p-2">
              {heroImageUrl ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px]">
                  <Image
                    src={heroImageUrl}
                    alt="Divi 5 layout preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] w-full rounded-[12px] bg-fog" />
              )}
            </Card>
          </div>
        </Container>
      </section>

      {/* Trust */}
      <Container className="py-6">
        <p className="text-center text-small font-medium uppercase tracking-wide text-muted">Validated · import-ready · built for Divi 5</p>
      </Container>

      {/* Featured packs */}
      {packs.length > 0 && (
        <section className="py-20">
          <Container>
            <SectionTitle eyebrow="Packs" title="Curated layout packs">Hand-picked collections for common site types.</SectionTitle>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </Container>
        </section>
      )}

      {/* Features */}
      <section className="py-20">
        <Container className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {FEATURES.map((f) => (
            <IconFeature
              key={f.title}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>}
              title={f.title}
              body={f.body}
            />
          ))}
        </Container>
      </section>

      {/* CTA */}
      <section className="py-16">
        <Container>
          <div className="rounded-card bg-navy px-8 py-16 text-center">
            <h2 className="text-h2 text-paper">Ready to skip the blank page?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lead text-paper/80">Browse the catalog and import a validated Divi 5 layout today.</p>
            <div className="mt-8 flex justify-center">
              <Button href="/browse">Browse layouts</Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
