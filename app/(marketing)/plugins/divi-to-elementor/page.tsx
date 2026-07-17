import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';
import { STATS } from '@/lib/site/stats';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

export const metadata: Metadata = {
  title: 'Divi to Elementor Converter — free WordPress plugin (pending review)',
  description:
    `Convert Divi pages and templates to Elementor — ${STATS.diviModulesMapped}+ modules mapped, batch conversion, all three Divi export formats. Free plugin pending wordpress.org review; join the waitlist to be notified the moment it ships.`,
};

// Batch mock: what a run over a small site looks like.
const BATCH_ROWS = [
  { page: 'Home', status: 'done' },
  { page: 'About', status: 'done' },
  { page: 'Services', status: 'done' },
  { page: 'Pricing', status: 'running' },
  { page: 'Contact', status: 'queued' },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Inherited a portfolio of Divi sites but standardized on Elementor. Batch runs turn each handover into an afternoon.',
  },
  {
    icon: 'storefront',
    title: 'The shop owner',
    body: 'The new team works in Elementor. WooCommerce modules map to their widget equivalents (Pro), so the store keeps selling.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Takes rescue projects in either builder. One converter each way means never turning down a migration.',
  },
];

const FAQ = [
  {
    question: 'When will the free plugin be available?',
    answer: "It's submitted to wordpress.org and awaiting review. We'll email the waitlist the moment it's approved and live.",
  },
  {
    question: 'Will there be a Pro version?',
    answer: 'Yes — Pro launches after the free plugin is approved, at $25/yr for unlimited sites, with Theme Builder templates and WooCommerce support.',
  },
  {
    question: 'Which Divi export formats work?',
    answer: 'All three — Divi Library JSON, portability exports, and raw post content. The converter detects the format automatically.',
  },
  {
    question: 'What about Divi Theme Builder templates?',
    answer: 'Headers, footers, and templates convert to Elementor Theme Builder equivalents in Pro. The free plugin covers page content.',
  },
  {
    question: 'What happens to modules without a mapping?',
    answer: `${STATS.diviModulesMapped}+ Divi modules have dedicated mappings. Anything exotic is preserved as an HTML widget and flagged in the conversion report — nothing is silently dropped.`,
  },
  {
    question: 'Does it modify my Divi site?',
    answer: 'No. You export from Divi and import into the Elementor site. The source site stays untouched for side-by-side comparison.',
  },
];

function BatchStatus({ status }: { status: string }) {
  if (status === 'done') return <span className="flex items-center gap-1.5 font-mono text-small text-green-600"><Icon name="check" size={15} /> converted</span>;
  if (status === 'running') return <span className="font-mono text-small text-action">converting…</span>;
  return <span className="font-mono text-small text-muted">queued</span>;
}

export default function D2EPage() {
  return (
    <main>
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero + waitlist */}
      <section id="top" className="border-b border-border bg-mist py-16">
        <Container>
          <h1 className="max-w-3xl text-h1 text-navy">Convert Divi to Elementor — the whole site, in batches.</h1>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            {STATS.diviModulesMapped}+ Divi modules mapped to their Elementor equivalents, every Divi export format
            supported, and a conversion report for every run. The same converter craft as our flagship — pointed the
            other way.
          </p>
          <Card className="mt-8 max-w-2xl border-amber-200 bg-amber-50 p-8">
            <p className="text-body text-navy">
              The free plugin is submitted and <strong>pending wordpress.org review</strong>. Leave your email and
              we&apos;ll tell you the moment it&apos;s approved — waitlist members hear first, including about Pro.
            </p>
            <div className="mt-4">
              <WaitlistForm source="divi_to_elementor_waitlist" cta="Notify me" />
            </div>
          </Card>
        </Container>
      </section>

      {/* Batch demo */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-h2 text-navy">Point it at pages, not paragraphs</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Select every page that should move and run one batch. Each page gets converted, reported on, and
                saved as an Elementor draft for review — you approve, it publishes.
              </p>
            </div>
            <Card className="p-6">
              <p className="text-small font-semibold uppercase tracking-wide text-muted">Batch run — 5 pages</p>
              <ul className="mt-3 divide-y divide-border">
                {BATCH_ROWS.map((r) => (
                  <li key={r.page} className="flex items-center justify-between py-2.5">
                    <span className="text-body text-navy">{r.page}</span>
                    <BatchStatus status={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      {/* Free vs Pro (planned) */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Free now (pending review), Pro after launch</h2>
          <ComparisonTable
            className="mt-8"
            caption="Divi to Elementor Converter — Free vs planned Pro"
            columns={['Free', 'Pro — $25/yr (after launch)']}
            rows={[
              { label: `${STATS.diviModulesMapped}+ module mappings`, values: [true, true] },
              { label: 'All three Divi export formats', values: [true, true] },
              { label: 'Batch conversion', values: [true, true] },
              { label: 'Conversion report per run', values: [true, true] },
              { label: 'Divi Theme Builder templates', values: [false, true] },
              { label: 'WooCommerce module → widget mapping', values: [false, true] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro pricing and scope may be refined at launch — waitlist members hear first."
          />
        </Container>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Who converts this direction</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Be first through the door."
        body="The waitlist hears the moment wordpress.org approves the free plugin — and gets launch pricing on Pro."
        cta={{ label: 'Join the waitlist', href: '#top' }}
        secondary={{ label: 'See all plugins', href: '/plugins' }}
      />
    </main>
  );
}
