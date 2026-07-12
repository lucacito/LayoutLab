import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { STATS } from '@/lib/site/stats';
import { listGuides } from '@/lib/guides';
import { StatStrip } from '@/components/marketing/StatStrip';
import { VerdictCard } from '@/components/marketing/VerdictCard';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { ProductDoors } from '@/components/marketing/ProductDoors';
import { CtaBand } from '@/components/marketing/CtaBand';
import { FreeLayoutsBand } from '@/components/marketing/FreeLayoutsBand';

const DEMO_STEPS: ChatStep[] = [
  { role: 'user', text: 'Change the hero headline to “Spring sale — 20% off everything” and center the button.' },
  { role: 'assistant', text: 'update_page_layout(page: "Home", …)' },
  { role: 'validator-fail', text: 'WRONG_FIELD_TYPE — button alignment must be an object, got string' },
  { role: 'assistant', text: 'Correcting the attribute shape, re-submitting…' },
  { role: 'validator-pass', text: 'Valid — 14 blocks, 0 violations. Saved to “Home”.' },
];

const FEATURED_GUIDES = ['how-to-convert-elementor-to-divi-5', 'connect-claude-to-divi-5', 'elementor-to-divi-migration-checklist'];

export default async function HomePage() {
  const guides = listGuides().filter((g) => FEATURED_GUIDES.includes(g.slug)).slice(0, 3);

  return (
    <main>
      {/* 1 — Hero: the promise, then proof */}
      <section className="border-b border-border bg-mist py-20">
        <Container className="text-center">
          <h1 className="mx-auto max-w-3xl text-h1 text-navy">Divi 5 tools that never ship a broken layout.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-muted">
            Converters and an AI editor built on a deterministic validator — every block, attribute, and nesting
            rule checked before anything touches your site. If it imports, it works.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/plugins/elementor-to-divi-5"
              className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
            >
              Convert Elementor to Divi 5
            </Link>
            <Link
              href="/plugins/divi-5-ai-editor"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Meet the AI Editor
            </Link>
          </div>
          <StatStrip
            className="mt-12"
            stats={[
              { value: String(STATS.elementorWidgetsMapped), label: 'widget types mapped' },
              { value: String(STATS.validatorBlockTypes), label: 'Divi 5 block types modeled' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
              { value: `${STATS.freeLayoutsPublished}+`, label: 'free layouts shipped' },
            ]}
          />
        </Container>
      </section>

      {/* 2 — Problem band */}
      <section className="bg-ink py-16 text-paper">
        <Container className="max-w-3xl text-center">
          <p className="text-small font-semibold uppercase tracking-wide text-paper/60">The problem</p>
          <h2 className="mt-3 text-h3 text-paper">Page-builder markup is unforgiving.</h2>
          <p className="mt-4 text-lead text-paper/85">
            Rebuild a site by hand and you lose weeks. Trust a naive converter — or raw AI output — and you get
            markup Divi half-renders: collapsed sections, attributes that don&apos;t exist, nesting the builder never
            allowed. And you find out after the import.
          </p>
        </Container>
      </section>

      {/* 3 — Mechanism */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-small font-semibold uppercase tracking-wide text-action">The fix</p>
              <h2 className="mt-3 text-h2 text-navy">Same input, same verdict.</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Everything we produce — converted pages, AI edits, generated layouts — runs through the same
                deterministic validator before it reaches you. Not a linter, not a vibe check: a strict schema of{' '}
                {STATS.validatorBlockTypes} Divi 5 block types with every attribute and nesting rule enforced.
              </p>
              <ol className="mt-8 space-y-4">
                {[
                  { t: 'Convert or generate', b: 'A converter maps your old markup; the AI drafts your edit.' },
                  { t: 'Validate', b: `${STATS.validatorViolationClasses} classes of violations checked — exact codes come back, and the tool self-corrects.` },
                  { t: 'Import clean', b: 'Only layouts with a passing verdict ever reach your site.' },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</span>
                    <div>
                      <h3 className="text-body font-semibold text-navy">{s.t}</h3>
                      <p className="mt-0.5 text-body text-muted">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <VerdictCard
              title="divi5-validator — layout.json"
              failures={[
                { code: 'WRONG_NESTING', detail: 'divi/button directly inside divi/section' },
                { code: 'UNKNOWN_MODULE_TYPE', detail: '“divi/hero” is not a Divi 5 block' },
              ]}
              passSummary="Valid — 14 blocks, 0 violations"
            />
          </div>
        </Container>
      </section>

      {/* 4 — Three doors */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-h2 text-navy">Three tools, one guarantee</h2>
            <p className="mt-4 text-lead text-muted">Different jobs, same validator underneath.</p>
          </div>
          <div className="mt-12">
            <ProductDoors />
          </div>
        </Container>
      </section>

      {/* 5 — Centerpiece demo */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <ValidatorChatDemo steps={DEMO_STEPS} />
            <div>
              <p className="text-small font-semibold uppercase tracking-wide text-action">Watch it work</p>
              <h2 className="mt-3 text-h2 text-navy">The AI makes the edit. The validator keeps it honest.</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                When your assistant gets an attribute wrong, it doesn&apos;t reach your database — it gets the exact
                violation back and fixes it. You see the corrected result, not the mistake.
              </p>
              <Link href="/plugins/divi-5-ai-editor" className="mt-6 inline-flex items-center gap-1.5 text-body font-semibold text-action hover:underline">
                Meet the AI Editor <Icon name="arrow_forward" size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* 6 — Free layouts (lead capture, reworded in FreeLayoutsBand) */}
      <FreeLayoutsBand />

      {/* 7 — Guides strip */}
      <section className="border-t border-border bg-mist py-16">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-h3 text-navy">From the lab notebook</h2>
            <Link href="/guides" className="text-small font-semibold text-action hover:underline">All guides</Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
                <Card className="h-full p-6 transition group-hover:-translate-y-0.5">
                  <h3 className="text-body font-semibold text-navy transition group-hover:text-action">{g.title}</h3>
                  <p className="mt-2 text-small text-muted">{g.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* 8 — Closing CTA */}
      <CtaBand
        title="Stop rebuilding. Start shipping."
        body="Move a whole site this week — headers, footers, global styles and all — into real, validated Divi 5 markup."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Browse free layouts', href: '/browse' }}
      />
    </main>
  );
}
