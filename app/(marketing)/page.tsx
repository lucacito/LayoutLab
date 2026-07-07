import { listPacks, listPublishedLayouts, facetCounts, type LayoutRow } from '@/lib/catalog/queries';
import { AXIS_META, NICHE_LABELS } from '@/lib/nav/menu-data';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { FeaturedPacks } from '@/components/marketing/FeaturedPacks';
import { RecentCarousel } from '@/components/RecentCarousel';
import { CategorySection } from '@/components/CategorySection';
import { ElementDirectory } from '@/components/ElementDirectory';
import { WhyChoose } from '@/components/marketing/WhyChoose';
import { ProblemSolutionProof } from '@/components/marketing/ProblemSolutionProof';
import { PopularStartingPoints } from '@/components/marketing/PopularStartingPoints';
import { TrustBadges } from '@/components/marketing/TrustBadges';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FaqSection } from '@/components/marketing/FaqSection';
import { ClosingCta } from '@/components/marketing/ClosingCta';

export const dynamic = 'force-dynamic';

const PILLS = [
  { label: 'Hero sections', href: '/type/hero' },
  { label: 'Pricing tables', href: '/type/pricing' },
  { label: 'SaaS', href: '/niche/saas' },
  { label: 'Agency', href: '/niche/agency' },
  { label: 'Minimal', href: '/style/minimal' },
  { label: 'Dark', href: '/style/dark' },
];

// Stock background for the single closing CTA band (Pexels).
const BROWSE_IMG = 'https://images.pexels.com/photos/9052803/pexels-photo-9052803.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=1260';

// Priority order for the curated "popular starting points" — the most broadly useful
// section types first. NOT download-driven (we don't fabricate counts); it's a hand-ordered
// spread so a first-time visitor lands on something usable fast.
const POPULAR_TYPE_ORDER = ['hero', 'pricing', 'testimonials', 'cta', 'faq', 'contact', 'features', 'gallery'];

export default async function HomePage() {
  // Premium multi-page "theme" packs get a dedicated promo band (newest first, so a
  // freshly-launched pack leads). Free packs stay in the free-first funnel elsewhere.
  let paidPacks: Awaited<ReturnType<typeof listPacks>> = [];
  try {
    paidPacks = (await listPacks())
      .filter((p) => p.kind === 'paid')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    paidPacks = [];
  }

  // Fetch published layouts once (newest-published first) and reuse across sections.
  let published: LayoutRow[] = [];
  try {
    published = await listPublishedLayouts();
  } catch {
    published = [];
  }

  // "Listed recently" = most-recently-published (listing time), not creation time.
  const recent = published.slice(0, 10);
  const recentIds = new Set(recent.map((l) => l.id));

  // Curated "popular starting points": one layout per priority type, avoiding the recent
  // set so the two rows don't show the same cards. Fall back to fill to 4 if the catalog
  // is thin on those types.
  const popular: LayoutRow[] = [];
  const usedIds = new Set<string>();
  for (const t of POPULAR_TYPE_ORDER) {
    const match = published.find((l) => l.type === t && !usedIds.has(l.id) && !recentIds.has(l.id));
    if (match) {
      popular.push(match);
      usedIds.add(match.id);
    }
    if (popular.length >= 4) break;
  }
  if (popular.length < 4) {
    for (const l of published) {
      if (usedIds.has(l.id)) continue;
      popular.push(l);
      usedIds.add(l.id);
      if (popular.length >= 4) break;
    }
  }

  // Group by industry → one homepage section per niche, busiest first.
  const industryMap = new Map<string, LayoutRow[]>();
  for (const l of published) {
    if (!l.niche) continue;
    const arr = industryMap.get(l.niche);
    if (arr) arr.push(l);
    else industryMap.set(l.niche, [l]);
  }
  const industries = [...industryMap.entries()]
    .map(([niche, items]) => ({ niche, items }))
    .sort((a, b) => b.items.length - a.items.length);

  let counts: Awaited<ReturnType<typeof facetCounts>> = { type: {}, niche: {}, style: {}, color: {}, columns: {} };
  try {
    counts = await facetCounts();
  } catch {
    /* keep empty counts */
  }

  return (
    <main>
      {/* Hero — full-bleed search */}
      <section className="relative isolate overflow-hidden bg-ink text-paper">
        {/* colored mesh base (shows until /hero-bg.jpg is added; the image covers it) */}
        <div
          className="absolute inset-0 -z-20"
          style={{
            background:
              'radial-gradient(60% 90% at 30% 0%, rgba(99,91,255,0.55), transparent), radial-gradient(55% 80% at 85% 30%, rgba(0,153,255,0.45), transparent), #07070B',
          }}
        />
        {/* Mobile: lighter portrait crop (~54KB). display:none ≥md so desktops never fetch it. */}
        <div className="absolute inset-0 -z-10 bg-cover bg-center md:hidden" style={{ backgroundImage: "url('/mobile-hero-bg.jpg')" }} />
        {/* Desktop: full-bleed landscape (~200KB). display:none <md so phones never fetch it. */}
        <div className="absolute inset-0 -z-10 hidden bg-cover bg-center md:block" style={{ backgroundImage: "url('/hero-bg.jpg')" }} />
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

      {/* 1 — Why choose us: benefit-led opener with honest, live stats + primary CTA */}
      <WhyChoose layoutCount={published.length} industryCount={industries.length} />

      {/* 2 — Recently listed, high up (people want something new) */}
      {recent.length > 0 && (
        <section className="py-12">
          <Container>
            <RecentCarousel layouts={recent} />
          </Container>
        </section>
      )}

      {/* The three problem → solution → proof cards, after the recent list */}
      <ProblemSolutionProof />

      {/* Find layouts by type (distinct tile treatment) — before the theme-pack band */}
      <ElementDirectory counts={counts} />

      {/* 3 — Hero #2: the premium theme-pack band, taller & flagship-led */}
      {paidPacks.length > 0 && <FeaturedPacks packs={paidPacks} />}

      {/* Curated "popular starting points" — no fabricated download counts */}
      <PopularStartingPoints layouts={popular} />

      {/* 5 — Find layouts by industry (2 cards each + view all, tightened) */}
      {industries.length > 0 && (
        <section className="border-y border-border bg-mist py-12">
          <Container>
            <SectionTitle eyebrow="By industry" title="Find layouts by industry">
              Divi 5 layouts built for your kind of business.
            </SectionTitle>
          </Container>
          <div className="mt-10 space-y-10">
            {industries.map(({ niche, items }) => (
              <CategorySection
                key={niche}
                label={NICHE_LABELS[niche] ?? niche}
                blurb={AXIS_META.niche[niche]?.blurb ?? ''}
                icon={AXIS_META.niche[niche]?.icon ?? 'category'}
                href={`/niche/${niche}`}
                count={items.length}
                layouts={items.slice(0, 2)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Testimonials — kept lower (still placeholder until real quotes land) */}
      <Testimonials />

      {/* Honest trust signals before the closing ask */}
      <TrustBadges />

      {/* FAQ */}
      <FaqSection />

      {/* 10 — One strong closing CTA */}
      <ClosingCta image={BROWSE_IMG} />
    </main>
  );
}
