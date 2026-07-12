import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { WIDGET_MAPPING_GROUPS, WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';
import { StatStrip } from '@/components/marketing/StatStrip';
import { MappingPanel } from '@/components/marketing/MappingPanel';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const WP_ORG_URL = 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/';

const PRODUCT_NAME = 'Elementor to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert Elementor pages and kits into real, validated Divi 5 layouts. Free plugin handles single-page JSON imports; Pro unlocks full kit ZIP import, global headers/footers, and priority support.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'Elementor to Divi 5 Converter — Free plugin + Pro',
  description:
    `Convert Elementor pages and kits to Divi 5 in minutes. ${WIDGET_TYPES_MAPPED} widget types mapped to real, validated Divi 5 modules. Free plugin for single pages; Pro adds full kit ZIP import and global styles — $49/yr, unlimited sites.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/elementor-to-divi-5` },
};

const MAPPING_PAIRS = [
  { from: 'heading', to: 'divi/heading' },
  { from: 'image-box', to: 'divi/blurb' },
  { from: 'price-table', to: 'divi/pricing-tables' },
  { from: 'form', to: 'divi/contact-form' },
  { from: 'testimonial', to: 'divi/testimonial' },
  { from: 'nav-menu', to: 'divi/menu' },
];

// Honest mock of a real conversion report: mostly clean, one graceful fallback.
const REPORT_ROWS = [
  { widget: 'heading ×6', result: 'divi/heading', ok: true },
  { widget: 'image ×9', result: 'divi/image', ok: true },
  { widget: 'icon-box ×4', result: 'divi/blurb', ok: true },
  { widget: 'form ×1', result: 'divi/contact-form', ok: true },
  { widget: 'lottie ×1', result: 'divi/code (embed fallback)', ok: false },
];

const PRO_WHY = [
  {
    title: 'Full kit ZIP import',
    body: 'Convert an entire Elementor site in one run — every page, template, and popup in the kit — instead of exporting pages one at a time.',
  },
  {
    title: 'Global headers & footers → Divi Theme Builder',
    body: 'Your site-wide header and footer land as real Theme Builder templates, not orphaned sections pasted on every page.',
  },
  {
    title: 'Global colors & typography',
    body: 'Elementor kit styles become Divi global presets, so the converted site keeps its design system — and stays editable.',
  },
  {
    title: 'Priority support + a year of updates',
    body: 'Elementor and Divi both move fast. Updates keep the mappings current; priority support gets you unstuck mid-migration.',
  },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Standardizing 30 client sites on Divi 5. Kit import turns a quarter of rebuild work into a review pass per site.',
  },
  {
    icon: 'storefront',
    title: 'The site owner',
    body: 'One site, one move. Free plugin, page by page, zero cost — upgrade only if the header and footer should come along.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Quotes Divi rebuilds by the page. The converter does the first 80%; the craft goes into the 20% clients actually see.',
  },
];

const FAQ = [
  {
    question: 'Is it really unlimited sites?',
    answer: 'Yes — a Pro license activates on as many sites as you own or build for clients, for as long as it stays active.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on the sites where it is already activated. You just stop receiving new updates and priority support until you renew.',
  },
  {
    question: 'Do I need the free plugin?',
    answer: 'Yes — Pro is a license that extends the free plugin. Install the free plugin from wordpress.org first, then activate Pro.',
  },
  {
    question: 'What if a widget has no mapping?',
    answer: `${WIDGET_TYPES_MAPPED} widget types have dedicated converters. Anything else falls back gracefully — content is preserved in a Divi code module and flagged in the conversion report, never silently dropped.`,
  },
  {
    question: 'Does it touch my Elementor site?',
    answer: 'No. You export from Elementor and import into your Divi site. The original site is never modified — you can compare both until you are happy.',
  },
  {
    question: 'Does it work with Divi 4?',
    answer: 'Output targets Divi 5 markup specifically — that is the point. Divi 5 imports it natively; we validate against the Divi 5 schema.',
  },
  {
    question: 'How do I know the output is valid?',
    answer: `Every converted layout is checked against a deterministic validator: ${STATS.validatorBlockTypes} Divi 5 block types, ${STATS.validatorViolationClasses} violation classes. If it passes, it imports.`,
  },
  {
    question: 'Which page-builder add-ons are covered?',
    answer: 'Elementor core plus Essential Addons, ElementsKit, Header Footer Elementor, and popular Woo widgets — see the full mapping reference on this page.',
  },
  {
    question: 'Is there a refund policy?',
    answer:
      "Digital goods are final-sale, but if the converter is genuinely broken for your migration and support cannot fix it within 14 days of purchase, we'll make it right. The full policy lives on the license page.",
  },
];

function ReportRow({ widget, result, ok }: { widget: string; result: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <code className="font-mono text-small text-navy">{widget}</code>
      <span className="flex items-center gap-2 font-mono text-small">
        {ok ? <Icon name="check" size={15} className="text-green-600" /> : <Icon name="subdirectory_arrow_right" size={15} className="text-amber-600" />}
        <span className={ok ? 'text-muted' : 'text-amber-700'}>{result}</span>
      </span>
    </li>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/elementor-to-divi-5`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          image: 'https://ps.w.org/jhmg-converter-for-elementor-to-divi/assets/banner-772x250.png',
          url,
          offer: { priceCents: 4900, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <h1 className="max-w-3xl text-h1 text-navy">Convert Elementor to Divi 5 — without rebuilding a thing.</h1>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            Export from Elementor, import into Divi 5, review real modules — not shortcode soup. Every conversion
            is checked against the Divi 5 schema before you see it. Free for single pages; Pro moves whole sites.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
            <a
              href={WP_ORG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Get the free plugin
            </a>
          </div>
          <StatStrip
            className="mt-12 justify-start"
            stats={[
              { value: String(WIDGET_TYPES_MAPPED), label: 'widget types mapped' },
              { value: `${STATS.activeInstalls}+`, label: 'active installs' },
              { value: '3', label: 'steps to a converted page' },
            ]}
          />
        </Container>
      </section>

      {/* Demo: mapping panel + conversion report */}
      <section className="py-20">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Real modules, mapped one to one</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Each Elementor widget has a dedicated converter that produces the equivalent Divi 5 module —
                content, links, and styling included. No generic wrappers, no lossy HTML dumps.
              </p>
              <MappingPanel className="mt-8" fromLabel="Elementor" toLabel="Divi 5" pairs={MAPPING_PAIRS} />
            </div>
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">A report for every run</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                The conversion report tells you exactly what happened to every widget — including the rare one
                without a mapping, which is preserved as an embed and flagged. Nothing is silently dropped.
              </p>
              <Card className="mt-8 p-6">
                <p className="text-small font-semibold uppercase tracking-wide text-muted">Conversion report — home.json</p>
                <ul className="mt-3 divide-y divide-border">
                  {REPORT_ROWS.map((r) => (
                    <ReportRow key={r.widget} {...r} />
                  ))}
                </ul>
                <p className="mt-3 text-small text-muted">20 of 21 widgets converted to native modules · 1 graceful fallback</p>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Three steps, no surprises</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { title: 'Export from Elementor', body: 'A page JSON (free) or the full kit ZIP (Pro) — straight from your existing site, which is never modified.' },
              { title: 'Upload in Tools', body: 'Open the plugin under WordPress → Tools on your Divi site and upload the export.' },
              { title: 'Review & publish', body: 'Widgets arrive as native Divi 5 modules with a per-widget report. Validated against the Divi 5 schema before you ever see it.' },
            ].map((s, i) => (
              <div key={s.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pro depth */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">What Pro actually buys you</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PRO_WHY.map((f) => (
              <Card key={f.title} className="p-7">
                <h3 className="text-body font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-body text-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Free vs Pro table */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Free vs. Pro</h2>
          <ComparisonTable
            className="mt-8"
            caption="Elementor to Divi 5 Converter — Free vs Pro"
            columns={['Free', 'Pro — $49/yr']}
            rows={[
              { label: 'Single-page JSON imports (unlimited)', values: [true, true] },
              { label: `${WIDGET_TYPES_MAPPED} widget-type mappings`, values: [true, true] },
              { label: 'Conversion report per run', values: [true, true] },
              { label: 'Full kit ZIP import', values: [false, true] },
              { label: 'Global headers/footers → Theme Builder', values: [false, true] },
              { label: 'Global colors & typography', values: [false, true] },
              { label: 'Updates', values: ['—', '1 year'] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses — renewal covers updates and support."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
            <a href={WP_ORG_URL} target="_blank" rel="noopener noreferrer" className="text-body font-semibold text-action hover:underline">
              Start with the free plugin
            </a>
          </div>
        </Container>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Who moves sites with it</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </section>

      {/* Widget mapping reference */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">The full mapping reference</h2>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            All {WIDGET_TYPES_MAPPED} widget types with a dedicated converter, straight from the plugin&apos;s
            registry. If yours is on this list, it converts to a native Divi 5 module.
          </p>
          <div className="mt-8 space-y-4">
            {WIDGET_MAPPING_GROUPS.map((g) => (
              <details key={g.group} className="rounded-card border border-border bg-paper p-5 shadow-soft">
                <summary className="cursor-pointer text-body font-semibold text-navy">
                  {g.group} <span className="text-muted">({g.widgets.length})</span>
                </summary>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {g.widgets.map((w) => (
                    <li key={w}>
                      <code className="rounded-button bg-fog px-2 py-1 font-mono text-small text-navy">{w}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20">
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
        title="Ship your migration this week."
        body="Full kits, global styles, headers and footers — converted into validated Divi 5 markup, reviewed by you."
        cta={{ label: 'Get Pro — $49/yr', href: '/pricing' }}
        secondary={{ label: 'Try the free plugin first', href: WP_ORG_URL }}
      />
    </main>
  );
}
