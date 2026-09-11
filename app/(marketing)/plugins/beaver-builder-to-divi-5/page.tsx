import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionShell } from '@/components/ui/SectionShell';
import { PageHero } from '@/components/marketing/PageHero';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { BEAVER_MODULE_GROUPS, BEAVER_MODULE_TYPES_MAPPED, BEAVER_REFERENCE_MODULES } from '@/lib/site/beaver-module-mappings';
import { StatStrip } from '@/components/marketing/StatStrip';
import { MappingPanel } from '@/components/marketing/MappingPanel';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';
import { FREE_PLUGIN_LINKS } from '@/lib/site/free-downloads';

// Direct download while the wordpress.org listing is under review. Once approved, point
// these at https://wordpress.org/plugins/jhmg-converter-for-beaver-builder-to-divi-5/ and
// delete public/downloads/.
const FREE_PLUGIN_PATH = FREE_PLUGIN_LINKS['beaver-to-divi5'].href;
const FREE_PLUGIN_URL = `${env.NEXT_PUBLIC_SITE_URL}${FREE_PLUGIN_PATH}`;

const PRODUCT_NAME = 'Beaver Builder to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert Beaver Builder pages into real, validated Divi 5 layouts. The free plugin converts one page per run, straight from your site or from an export; Pro converts the whole site in one run and moves Beaver Themer headers and footers into the Divi Theme Builder.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'Beaver Builder to Divi 5 Converter: Free plugin + Pro',
  description:
    `Convert Beaver Builder pages to Divi 5 in minutes. Every module in Beaver Builder's reference (${BEAVER_REFERENCE_MODULES}) plus PowerPack mapped to native, validated Divi 5 modules. Free plugin, one page per run; Pro converts whole sites and Themer headers and footers, at $25/yr on unlimited sites.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/beaver-builder-to-divi-5` },
};

const MAPPING_PAIRS = [
  { from: 'heading', to: 'divi/heading' },
  { from: 'photo', to: 'divi/image' },
  { from: 'callout', to: 'divi/blurb' },
  { from: 'numbers', to: 'divi/number-counter' },
  { from: 'contact-form', to: 'divi/contact-form' },
  { from: 'pricing-table', to: 'divi/pricing-tables' },
];

// Honest mock of a real conversion report: mostly clean, two items listed for review.
const REPORT_ROWS = [
  { module: 'heading ×9', result: 'divi/heading', ok: true },
  { module: 'photo ×14', result: 'divi/image', ok: true },
  { module: 'rich-text ×11', result: 'divi/text', ok: true },
  { module: 'button ×4', result: 'divi/button (hover colours listed)', ok: false },
  { module: 'acf-block ×1', result: 'divi/code (placeholder, listed)', ok: false },
];

const PRO_WHY = [
  {
    title: 'The whole site in one run',
    body: 'Pick every Beaver Builder page on the site, or upload one WordPress export, and convert them together. Free does the same work one page at a time.',
  },
  {
    title: 'Themer headers & footers → Divi Theme Builder',
    body: 'Beaver Themer header and footer layouts land as Divi Theme Builder global templates. Converting the same layout again updates the result instead of adding another.',
  },
  {
    title: 'Priority support + a year of updates',
    body: 'Beaver Builder and Divi both move fast. Updates keep the module mappings current; priority support gets you unstuck mid-migration.',
  },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Standardizing client sites on Divi 5. Check each page first, convert the lot in one run, and spend the saved days on review instead of rebuilds.',
  },
  {
    icon: 'storefront',
    title: 'The site owner',
    body: 'One site, one move. Free plugin, page by page, zero cost. Upgrade only if the header and footer should come along.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Quotes Divi rebuilds by the page. The converter does the first 80%; the craft goes into the 20% clients actually see.',
  },
];

const FAQ = [
  {
    question: 'Do I need Beaver Builder installed?',
    answer: 'Only to pick pages from the list on your site. To convert pages from another site, export them there and upload the export file; Beaver Builder is not needed on the Divi site.',
  },
  {
    question: 'Will this change my Beaver Builder pages?',
    answer: 'No. Converting always creates a new Divi draft. The original page is never modified, and every run can be undone with one click from the Recent conversions list.',
  },
  {
    question: 'Which modules convert?',
    answer: `Every module in Beaver Builder's own module reference (${BEAVER_REFERENCE_MODULES} of them, Lite and Pro), the Beaver Themer Loop and Popup, Themer field connections, and PowerPack's Advanced Heading, Icon List and Fluent Forms. The full list is on this page.`,
  },
  {
    question: 'What happens to a module the converter does not know?',
    answer: 'It leaves a labelled placeholder that keeps its text and position, and it is listed in the report and on the coverage panel so you know what to rebuild by hand. Nothing is silently dropped.',
  },
  {
    question: 'What about Ultimate Addons and PowerPack settings?',
    answer: 'Sites running those add-ons save around a hundred extra settings on every row and column. The converter recognises the families, ignores the ones left at their defaults and reports the ones you switched on, so the report only lists what the page really loses.',
  },
  {
    question: 'Does it work with Divi 4?',
    answer: 'Output targets Divi 5 block markup specifically. On Divi 4 or without Divi the plugin explains itself and does nothing.',
  },
  {
    question: 'How do I know the output is valid?',
    answer: `Every converted layout is checked against a deterministic validator: ${STATS.validatorBlockTypes} Divi 5 block types, ${STATS.validatorViolationClasses} violation classes. If it passes, Divi 5 renders it.`,
  },
  {
    question: 'Is it really unlimited sites?',
    answer: 'Yes. A Pro license activates on as many sites as you own or build for clients, for as long as it stays active.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on the sites where it is already activated. You just stop receiving new updates and priority support until you renew.',
  },
  {
    question: 'Do I need the free plugin?',
    answer: 'Yes. Pro is a license that extends the free plugin. Install the free plugin first (download it from this page while the wordpress.org listing is under review), then activate Pro.',
  },
  {
    question: 'Is there a refund policy?',
    answer:
      "Digital goods are final-sale, but if the converter is genuinely broken for your migration and support cannot fix it within 14 days of purchase, we'll make it right. The full policy lives on the license page.",
  },
];

function ReportRow({ module, result, ok }: { module: string; result: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <code className="font-mono text-small text-navy">{module}</code>
      <span className="flex items-center gap-2 font-mono text-small">
        {ok ? <Icon name="check" size={15} className="text-green-600" /> : <Icon name="subdirectory_arrow_right" size={15} className="text-amber-600" />}
        <span className={ok ? 'text-muted' : 'text-amber-700'}>{result}</span>
      </span>
    </li>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/beaver-builder-to-divi-5`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          image: 'https://ps.w.org/jhmg-converter-for-beaver-builder-to-divi-5/assets/banner-772x250.png',
          url,
          offer: { priceCents: 2500, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <PageHero
        align="left"
        eyebrow="Beaver Builder → Divi 5 Converter"
        title="Convert Beaver Builder to Divi 5 without rebuilding a thing."
        lead="Pick a page on your site, read the report, convert. Every Beaver Builder module becomes a native Divi 5 module, checked against the Divi 5 schema before anything is written, and every run can be undone. Free for one page per run; Pro moves the whole site."
      >
        <div className="flex flex-wrap items-center gap-3">
          <BuyProButton product="beaver-to-divi5-pro" label="Get Pro · $25/yr" />
          <a
            href={FREE_PLUGIN_PATH}
            download
            className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
          >
            Download the free plugin (.zip)
          </a>
        </div>
        <p className="mt-3 text-small text-paper/70">
          Direct download while the wordpress.org listing is under review. Install it from Plugins → Add New → Upload Plugin.
        </p>
        <StatStrip
          className="mt-12 !mx-0"
          tone="dark"
          stats={[
            { value: String(BEAVER_MODULE_TYPES_MAPPED), label: 'module types mapped' },
            { value: `${BEAVER_REFERENCE_MODULES}/${BEAVER_REFERENCE_MODULES}`, label: "of Beaver Builder's module reference" },
            { value: '1 click', label: 'to undo any run' },
          ]}
        />
      </PageHero>

      {/* Demo: mapping panel + conversion report */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Real modules, mapped one to one</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Each Beaver Builder module has a dedicated converter that produces the equivalent Divi 5 module,
                content, links, images, colours, typography, spacing and backgrounds included. Rows become sections,
                column groups become rows, columns stay columns.
              </p>
              <MappingPanel className="mt-8" fromLabel="Beaver Builder" toLabel="Divi 5" pairs={MAPPING_PAIRS} />
            </div>
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Check first, then convert</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Click Check this page and you get the structure the conversion will produce and everything that
                will not carry over, by name, before anything is written. Convert creates a new Divi draft; your
                Beaver Builder page is never touched.
              </p>
              <Card className="mt-8 p-6">
                <p className="eyebrow text-muted">Conversion report · Home</p>
                <ul className="mt-3 divide-y divide-border">
                  {REPORT_ROWS.map((r) => (
                    <ReportRow key={r.module} {...r} />
                  ))}
                </ul>
                <p className="mt-3 text-small text-muted">39 modules converted to native modules · 2 items listed for review</p>
              </Card>
            </div>
          </div>
        </Container>
      </SectionShell>

      {/* How it works */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Three steps, no surprises</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { title: 'Pick the page', body: 'Choose a Beaver Builder page from the list on your site, or upload a WordPress export or Beaver Builder template from another site.' },
              { title: 'Check it', body: 'Read the report: the structure the conversion will produce, and what will not carry over. Nothing has been written yet.' },
              { title: 'Convert & review', body: 'A new Divi 5 draft appears with every module native and a per-page report. Review it in the Divi Builder, publish when ready, or undo with one click.' },
            ].map((s, i) => (
              <div key={s.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* Pro depth */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">What Pro actually buys you</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PRO_WHY.map((f) => (
              <Card key={f.title} className="p-7">
                <h3 className="text-body font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-body text-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* Free vs Pro table */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Free vs. Pro</h2>
          <ComparisonTable
            className="mt-8"
            caption="Beaver Builder to Divi 5 Converter: Free vs Pro"
            columns={['Free', 'Pro · $25/yr']}
            rows={[
              { label: 'Convert pages already on your site', values: [true, true] },
              { label: 'Upload a WordPress export or Beaver Builder template', values: [true, true] },
              { label: `${BEAVER_MODULE_TYPES_MAPPED} module-type mappings`, values: [true, true] },
              { label: 'Check-before-convert report and one-click undo', values: [true, true] },
              { label: 'Pages per run', values: ['1', 'Unlimited'] },
              { label: 'Themer headers/footers → Divi Theme Builder', values: [false, true] },
              { label: 'Updates', values: ['n/a', '1 year'] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses. Renewal covers updates and support."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="beaver-to-divi5-pro" label="Get Pro · $25/yr" />
            <a href={FREE_PLUGIN_PATH} download className="text-body font-semibold text-action hover:underline">
              Start with the free plugin (.zip)
            </a>
          </div>
        </Container>
      </SectionShell>

      {/* Use cases */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Who moves sites with it</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </SectionShell>

      {/* Module mapping reference */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">The full mapping reference</h2>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            All {BEAVER_MODULE_TYPES_MAPPED} module types with a dedicated converter, straight from the plugin&apos;s
            registry. If yours is on this list, it converts to a native Divi 5 module. Pro-module mappings come from
            Beaver Builder&apos;s documentation and exported layouts, so the report marks them as approximate for you to check.
          </p>
          <div className="mt-8 space-y-4">
            {BEAVER_MODULE_GROUPS.map((g) => (
              <details key={g.group} className="rounded-card border border-border bg-paper p-5 shadow-soft">
                <summary className="cursor-pointer text-body font-semibold text-navy">
                  {g.group} <span className="text-muted">({g.modules.length})</span>
                </summary>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {g.modules.map((m) => (
                    <li key={m}>
                      <code className="rounded-button bg-fog px-2 py-1 font-mono text-small text-navy">{m}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* FAQ */}
      <SectionShell tone="paper" pad="lg">
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
        title="Ship your migration this week."
        body="Whole sites, Themer headers and footers, converted into validated Divi 5 markup and reviewed by you."
        cta={{ label: 'Get Pro · $25/yr', href: '/pricing' }}
        secondary={{ label: 'Try the free plugin first', href: FREE_PLUGIN_URL }}
      />
    </main>
  );
}
