import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { env } from '@/lib/env';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const WP_ORG_URL = 'https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/';

const PRODUCT_NAME = 'Divi to Elementor Converter';
const PRODUCT_DESCRIPTION =
  `Convert Divi pages and templates into Elementor — ${STATS.diviModulesMapped}+ modules mapped, batch conversion, and all three Divi export formats. Free plugin on wordpress.org; Pro adds Theme Builder templates and WooCommerce mapping.`;

export const metadata: Metadata = {
  title: 'Divi to Elementor Converter — free WordPress plugin + Pro',
  description:
    `Convert Divi pages and templates to Elementor — ${STATS.diviModulesMapped}+ modules mapped, batch conversion, all three Divi export formats. Free on wordpress.org; Pro adds Theme Builder templates and WooCommerce mapping — $25/yr, unlimited sites.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-to-elementor` },
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
    question: 'Where do I get the free plugin?',
    answer: 'From wordpress.org — search "JHMG Converter For Divi to Elementor" in your WordPress admin under Plugins → Add New, or install it from the plugin directory.',
  },
  {
    question: 'What does Pro add?',
    answer: 'Divi Theme Builder templates (headers, footers, and layouts) convert to their Elementor Theme Builder equivalents, plus WooCommerce module → widget mapping. $25/yr on unlimited sites, including a year of updates and priority support.',
  },
  {
    question: 'Do I need the free plugin to use Pro?',
    answer: 'Yes — Pro is a license that extends the free plugin. Install the free plugin from wordpress.org first, then activate Pro.',
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
  const url = `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-to-elementor`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          url,
          offer: { priceCents: 2500, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <SectionShell tone="hero" underHeader bottom="lg" blooms curveBottom={EDGE.paper} id="top">
        <Container>
          <Eyebrow tone="dark" className="mb-4">Divi → Elementor Converter</Eyebrow>
          <h1 className="max-w-3xl text-h1 text-paper">Convert Divi to Elementor — the whole site, in batches.</h1>
          <p className="mt-6 max-w-2xl text-lead text-paper/80">
            {STATS.diviModulesMapped}+ Divi modules mapped to their Elementor equivalents, every Divi export format
            supported, and a conversion report for every run. The same converter craft as our flagship — pointed the
            other way.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <BuyProButton product="divi-to-elementor-pro" label="Get Pro — $25/yr" />
            <a
              href={WP_ORG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
            >
              Get the free plugin
            </a>
          </div>
          <StatStrip
            className="mt-12 !mx-0"
            tone="dark"
            stats={[
              { value: `${STATS.diviModulesMapped}+`, label: 'Divi modules mapped' },
              { value: '3', label: 'Divi export formats supported' },
              { value: '1', label: 'conversion report per run' },
            ]}
          />
        </Container>
      </SectionShell>

      {/* Batch demo */}
      <SectionShell tone="paper" pad="lg">
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
              <p className="eyebrow text-muted">Batch run — 5 pages</p>
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
      </SectionShell>

      {/* Free vs Pro (planned) */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Free on wordpress.org, Pro when you need the whole site</h2>
          <ComparisonTable
            className="mt-8"
            caption="Divi to Elementor Converter — Free vs Pro"
            columns={['Free', 'Pro — $25/yr']}
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
            footnote="One Pro license activates on unlimited sites, yours or your clients'. If it lapses, activated sites keep working — renewal buys updates and support."
          />
        </Container>
      </SectionShell>

      {/* Use cases */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Who converts this direction</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </SectionShell>

      {/* FAQ */}
      <SectionShell tone="mist" pad="lg">
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
      </SectionShell>

      <CtaBand
        eyebrow="Free on wordpress.org"
        title="Move the site, not the weekend."
        body="Install the free plugin and batch-convert your first pages today. Upgrade to Pro when the Theme Builder templates and WooCommerce modules need to come along."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'See all plugins', href: '/plugins' }}
        curveTop={EDGE.mist}
      />
    </main>
  );
}
