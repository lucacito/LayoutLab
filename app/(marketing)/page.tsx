import { listPacks, listLayouts, listPublishedLayouts, facetCounts, type LayoutRow } from '@/lib/catalog/queries';
import { parseFilters } from '@/lib/catalog/filters';
import { AXIS_META, NICHE_LABELS } from '@/lib/nav/menu-data';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconFeature } from '@/components/ui/IconFeature';
import { Icon } from '@/components/ui/Icon';
import { PackCard } from '@/components/PackCard';
import { RecentCarousel } from '@/components/RecentCarousel';
import { CategorySection } from '@/components/CategorySection';
import { ElementDirectory } from '@/components/ElementDirectory';
import { SocialProof } from '@/components/marketing/SocialProof';
import { ProblemSolutionProof } from '@/components/marketing/ProblemSolutionProof';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { TrustBadges } from '@/components/marketing/TrustBadges';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FaqSection } from '@/components/marketing/FaqSection';
import { CustomBuildCta } from '@/components/marketing/CustomBuildCta';
import { CtaNote } from '@/components/ui/CtaNote';

export const dynamic = 'force-dynamic';

const PILLS = [
  { label: 'Hero sections', href: '/type/hero' },
  { label: 'Pricing tables', href: '/type/pricing' },
  { label: 'SaaS', href: '/niche/saas' },
  { label: 'Agency', href: '/niche/agency' },
  { label: 'Minimal', href: '/style/minimal' },
  { label: 'Dark', href: '/style/dark' },
];

// Stock backgrounds for the closing CTA band (Pexels).
const CUSTOM_IMG = 'https://images.pexels.com/photos/34140/pexels-photo.jpg?auto=compress&cs=tinysrgb&dpr=2&w=1260';
const BROWSE_IMG = 'https://images.pexels.com/photos/9052803/pexels-photo-9052803.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=1260';

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

  let recent: Awaited<ReturnType<typeof listLayouts>> = [];
  try {
    recent = (await listLayouts(parseFilters({}))).slice(0, 10);
  } catch {
    recent = [];
  }

  // Group all published layouts by industry → one homepage section per niche, busiest first.
  let industries: { niche: string; items: LayoutRow[] }[] = [];
  try {
    const map = new Map<string, LayoutRow[]>();
    for (const l of await listPublishedLayouts()) {
      if (!l.niche) continue;
      const arr = map.get(l.niche);
      if (arr) arr.push(l);
      else map.set(l.niche, [l]);
    }
    industries = [...map.entries()]
      .map(([niche, items]) => ({ niche, items }))
      .sort((a, b) => b.items.length - a.items.length);
  } catch {
    industries = [];
  }

  let counts: Awaited<ReturnType<typeof facetCounts>> = { type: {}, niche: {}, style: {}, color: {} };
  try {
    counts = await facetCounts();
  } catch {
    /* keep empty counts */
  }

  return (
    <main>
      {/* Hero — full-bleed */}
      <section className="relative isolate overflow-hidden bg-ink text-paper">
        {/* colored mesh base (shows until /hero-bg.jpg is added; the image covers it) */}
        <div
          className="absolute inset-0 -z-20"
          style={{
            background:
              'radial-gradient(60% 90% at 30% 0%, rgba(99,91,255,0.55), transparent), radial-gradient(55% 80% at 85% 30%, rgba(0,153,255,0.45), transparent), #07070B',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.jpg')" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/80" />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center md:py-36">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-small font-semibold text-paper backdrop-blur">
            <Icon name="bolt" size={16} className="text-action" /> Free Divi 5 layouts — no account needed
          </span>
          <h1 className="mt-5 text-h1 text-paper">Free Divi 5 sections, ready to import.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lead text-paper/85">
            Browse a growing library of validated layouts. Click a section, download the JSON, and import it into Divi 5 in
            seconds — free to start, premium packs when you scale.
          </p>

          <form action="/browse" className="mx-auto mt-9 flex max-w-2xl items-center gap-1 rounded-full bg-paper p-2 shadow-lg">
            <Icon name="search" size={22} className="ml-3 text-muted" />
            <input
              name="q"
              type="search"
              placeholder="Search heroes, pricing, landing pages…"
              aria-label="Search layouts"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-body text-navy outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-action text-paper transition hover:brightness-110"
            >
              <Icon name="arrow_forward" size={22} />
            </button>
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {PILLS.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="rounded-full bg-paper/10 px-4 py-1.5 text-small font-medium text-paper backdrop-blur transition hover:bg-paper/20"
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof + the classic problem → solution → proof flow */}
      <SocialProof />
      <ProblemSolutionProof />

      {/* How it works — 3 steps */}
      <HowItWorks />

      {/* Listed recently */}
      {recent.length > 0 && (
        <section className="py-16">
          <Container>
            <RecentCarousel layouts={recent} />
          </Container>
        </section>
      )}

      {/* Trust signals */}
      <TrustBadges />

      {/* Every kind of element — compact, exhaustive directory (megamenu-style) */}
      <ElementDirectory counts={counts} />

      {/* Browse by industry — one section per niche */}
      {industries.length > 0 && (
        <section className="border-y border-border bg-mist py-16">
          <Container>
            <SectionTitle eyebrow="Industries" title="Browse by industry">
              Find Divi 5 layouts built for your kind of business.
            </SectionTitle>
          </Container>
          <div className="mt-12 space-y-16">
            {industries.map(({ niche, items }) => (
              <CategorySection
                key={niche}
                label={NICHE_LABELS[niche] ?? niche}
                blurb={AXIS_META.niche[niche]?.blurb ?? ''}
                icon={AXIS_META.niche[niche]?.icon ?? 'category'}
                href={`/niche/${niche}`}
                count={items.length}
                layouts={items.slice(0, 4)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      <Testimonials />

      {/* Featured packs */}
      {packs.length > 0 && (
        <section className="pb-16">
          <Container>
            <SectionTitle eyebrow="Packs" title="Curated layout packs">Hand-picked collections for common site types.</SectionTitle>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </Container>
        </section>
      )}

      {/* Features */}
      <section className="py-16">
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

      {/* FAQ */}
      <FaqSection />

      {/* Custom build + final CTA — full-bleed, with stock imagery */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <CustomBuildCta image={CUSTOM_IMG} />
          <div className="relative isolate flex h-full min-h-[360px] flex-col justify-center overflow-hidden rounded-card px-8 py-12 text-center text-paper">
            <div className="absolute inset-0 -z-20 bg-cover bg-center transition-transform duration-700 hover:scale-105" style={{ backgroundImage: `url(${BROWSE_IMG})` }} />
            <div className="absolute inset-0 -z-10 bg-gradient-to-tl from-ink/95 via-navy/90 to-action/55" />
            <h2 className="text-h2 text-paper">Ready to skip the blank page?</h2>
            <p className="mx-auto mt-4 max-w-md text-lead text-paper/85">Browse the catalog and import a validated Divi 5 layout in seconds.</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button href="/browse">Browse layouts</Button>
              <CtaNote className="text-paper/80" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
