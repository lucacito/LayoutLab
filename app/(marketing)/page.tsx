import { listPacks, listLayouts } from '@/lib/catalog/queries';
import { parseFilters } from '@/lib/catalog/filters';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconFeature } from '@/components/ui/IconFeature';
import { Icon } from '@/components/ui/Icon';
import { PackCard } from '@/components/PackCard';
import { RecentCarousel } from '@/components/RecentCarousel';

export const dynamic = 'force-dynamic';

const PILLS = [
  { label: 'Hero sections', href: '/type/hero' },
  { label: 'Pricing tables', href: '/type/pricing' },
  { label: 'SaaS', href: '/niche/saas' },
  { label: 'Agency', href: '/niche/agency' },
  { label: 'Minimal', href: '/style/minimal' },
  { label: 'Dark', href: '/style/dark' },
];

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

      {/* Listed recently */}
      {recent.length > 0 && (
        <section className="py-16">
          <Container>
            <RecentCarousel layouts={recent} />
          </Container>
        </section>
      )}

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
