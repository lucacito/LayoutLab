import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Divi5Lab builds migration converters, an AI editor, and free layouts for Divi 5 — all gated by one deterministic validator. Same input, same verdict.',
};

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-border bg-mist py-16">
        <Container className="max-w-3xl">
          <h1 className="text-h1 text-navy">The lab behind the validator.</h1>
          <p className="mt-5 text-lead text-muted">
            Divi5Lab exists because of one stubborn observation: converters and AI both produce confident,
            broken page-builder markup — and nobody finds out until after the import.
          </p>
        </Container>
      </section>

      <section className="py-16">
        <Container className="max-w-3xl space-y-12">
          <div>
            <h2 className="text-section text-navy">The problem we kept hitting</h2>
            <p className="mt-3 text-body text-muted">
              We build WordPress sites for a living. Every migration meant the same choice: weeks of manual
              rebuilding, or a converter whose output half-rendered — collapsed sections, invented attributes,
              nesting Divi never allowed. AI made it worse, not better: language models generate page-builder
              markup fluently and wrongly at the same time.
            </p>
          </div>

          <div>
            <h2 className="text-section text-navy">Same input, same verdict</h2>
            <p className="mt-3 text-body text-muted">
              So we built a deterministic validator: a strict schema of {STATS.validatorBlockTypes} Divi 5 block
              types — every attribute, every nesting rule — derived from real Divi 5 exports, not documentation.
              It isn&apos;t a linter and it doesn&apos;t have opinions. Feed it a layout twice and you get the same
              verdict twice, with exact violation codes. Everything we ship passes through it: converted pages,
              AI edits, generated layouts. No passing verdict, no publish. That&apos;s the whole trust model.
            </p>
          </div>

          <div>
            <h2 className="text-section text-navy">The proving ground</h2>
            <p className="mt-3 text-body text-muted">
              The <Link href="/browse" className="text-action hover:underline">free layout catalog</Link> is where
              the validator earns its keep: hundreds of layouts generated, validated, rendered, screenshotted, and
              shipped by the same pipeline our tools use. When a rule is wrong, the catalog finds it before you do.
              That&apos;s also why the layouts are free — they&apos;re the lab notes, published.
            </p>
          </div>

          <StatStrip
            className="justify-start"
            stats={[
              { value: `${STATS.freeLayoutsPublished}+`, label: 'free layouts shipped' },
              { value: String(STATS.elementorWidgetsMapped), label: 'widget types mapped' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
            ]}
          />

          <div>
            <h2 className="text-section text-navy">Who we are</h2>
            <p className="mt-3 text-body text-muted">
              Divi5Lab is built by <span className="font-semibold text-navy">JHMG</span>, a small team that has
              shipped WordPress sites for agencies and businesses for years. We&apos;d rather publish a validator
              verdict than a promise — if a tool of ours says a layout imports clean, that claim was checked by a
              machine, not a copywriter.
            </p>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Kick the tires, free."
        body="Browse the catalog, convert a page, or wire your AI assistant to a test site — every product has a free tier."
        cta={{ label: 'See the plugins', href: '/plugins' }}
        secondary={{ label: 'Browse free layouts', href: '/browse' }}
      />
    </main>
  );
}
