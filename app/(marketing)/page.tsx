import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FloatingStack } from '@/components/ui/FloatingStack';
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

/** Satellite panel for the hero's floating stack. */
function MiniPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-paper/15 bg-paper/10 p-4 shadow-float backdrop-blur-md">
      <p className="eyebrow text-paper/50">{label}</p>
      <div className="mt-2.5 space-y-1.5 font-mono text-small text-paper/85">{children}</div>
    </div>
  );
}

export default async function HomePage() {
  const guides = listGuides().filter((g) => FEATURED_GUIDES.includes(g.slug)).slice(0, 3);

  return (
    <main>
      {/* 1 — Hero: the promise, then proof, on the brand canvas */}
      {/* `bottom="xl"` keeps the floating stack clear of the curved seam. */}
      <SectionShell tone="hero" underHeader bottom="xl" blooms curveBottom={EDGE.paper}>
        <Container className="text-center">
          <Eyebrow tone="dark" className="mb-5">Validated Divi 5 tooling</Eyebrow>
          <h1 className="mx-auto max-w-4xl text-display text-paper">Divi 5 tools that never ship a broken layout.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lead text-paper/80">
            Converters and an AI editor built on a deterministic validator — every block, attribute, and nesting
            rule checked before anything touches your site. If it imports, it works.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button href="/plugins/elementor-to-divi-5" size="lg" variant="primary">Convert Elementor to Divi 5</Button>
            <Button href="/plugins/divi-5-ai-editor" size="lg" variant="onDark">Meet the AI Editor</Button>
          </div>

          <StatStrip
            className="mt-14"
            tone="dark"
            stats={[
              { value: String(STATS.elementorWidgetsMapped), label: 'widget types mapped' },
              { value: String(STATS.validatorBlockTypes), label: 'Divi 5 block types modeled' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
              { value: `${STATS.freeLayoutsPublished}+`, label: 'free layouts shipped' },
            ]}
          />

          {/* The product, floating over the canvas — the verdict is the hero image. */}
          <FloatingStack
            className="mx-auto mt-16 max-w-3xl"
            main={
              <VerdictCard
                title="divi5-validator — layout.json"
                failures={[
                  { code: 'WRONG_NESTING', detail: 'divi/button directly inside divi/section' },
                  { code: 'UNKNOWN_MODULE_TYPE', detail: '“divi/hero” is not a Divi 5 block' },
                ]}
                passSummary="Valid — 14 blocks, 0 violations"
                className="text-left"
              />
            }
            left={
              <MiniPanel label="Converting">
                <p>home ✓ · about ✓</p>
                <p>pricing <span className="text-g-pink">converting…</span></p>
              </MiniPanel>
            }
            right={
              <MiniPanel label="AI edit">
                <p>“Center the hero button”</p>
                <p className="text-g-cyan">✓ validated · saved</p>
              </MiniPanel>
            }
          />
        </Container>
      </SectionShell>

      {/* 2 — Problem band */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <SectionTitle eyebrow="The problem" title="Page-builder markup is unforgiving.">
            Rebuild a site by hand and you lose weeks. Trust a naive converter — or raw AI output — and you get
            markup Divi half-renders: collapsed sections, attributes that don&apos;t exist, nesting the builder never
            allowed. And you find out after the import.
          </SectionTitle>
        </Container>
      </SectionShell>

      {/* 3 — Mechanism, on the canvas */}
      <SectionShell tone="deep" pad="lg" blooms curveTop={EDGE.paper}>
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Eyebrow tone="dark">The fix</Eyebrow>
              <h2 className="mt-4 text-h2 text-paper">Same input, same verdict.</h2>
              <p className="mt-5 max-w-xl text-lead text-paper/80">
                Everything we produce — converted pages, AI edits, generated layouts — runs through the same
                deterministic validator before it reaches you. Not a linter, not a vibe check: a strict schema of{' '}
                {STATS.validatorBlockTypes} Divi 5 block types with every attribute and nesting rule enforced.
              </p>
              <ol className="mt-10 space-y-6">
                {[
                  { t: 'Convert or generate', b: 'A converter maps your old markup; the AI drafts your edit.' },
                  { t: 'Validate', b: `${STATS.validatorViolationClasses} classes of violations checked — exact codes come back, and the tool self-corrects.` },
                  { t: 'Import clean', b: 'Only layouts with a passing verdict ever reach your site.' },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-paper/25 bg-paper/10 font-display font-bold text-paper backdrop-blur">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-section text-paper">{s.t}</h3>
                      <p className="mt-1 text-body text-paper/70">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <ValidatorChatDemo steps={DEMO_STEPS} className="animate-float" />
          </div>
        </Container>
      </SectionShell>

      {/* 4 — Three doors */}
      <SectionShell tone="mist" pad="lg" curveTop={EDGE.deepBottom}>
        <Container>
          <SectionTitle eyebrow="Pick your door" title="Three tools, one guarantee">
            Different jobs, same validator underneath.
          </SectionTitle>
          <div className="mt-16">
            <ProductDoors />
          </div>
        </Container>
      </SectionShell>

      {/* 5 — Free layouts (lead capture) */}
      <FreeLayoutsBand />

      {/* 6 — Guides strip */}
      <SectionShell tone="mist" pad="md">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Field notes</Eyebrow>
              <h2 className="mt-3 text-h3 text-navy">From the lab notebook</h2>
            </div>
            <Link href="/guides" className="text-small font-semibold text-action hover:underline">All guides</Link>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
                <Card className="h-full p-7 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-lift">
                  <h3 className="text-section leading-snug text-navy transition group-hover:text-action">{g.title}</h3>
                  <p className="mt-3 text-small text-muted">{g.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-small font-semibold text-action">
                    Read guide <Icon name="arrow_forward" size={15} />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* 7 — Closing CTA, straight into the footer's canvas */}
      <CtaBand
        eyebrow="Ready when you are"
        title="Stop rebuilding. Start shipping."
        body="Move a whole site this week — headers, footers, global styles and all — into real, validated Divi 5 markup."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Browse free layouts', href: '/browse' }}
        curveTop={EDGE.mist}
      />
    </main>
  );
}
