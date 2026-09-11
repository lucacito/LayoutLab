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
import {
  WPBAKERY_COVERAGE_PARENTHETICAL,
  WPBAKERY_ELEMENT_GROUPS,
  WPBAKERY_ELEMENT_TYPES_MAPPED,
  WPBAKERY_REGISTERED_ELEMENTS,
} from '@/lib/site/wpbakery-element-mappings';
import { StatStrip } from '@/components/marketing/StatStrip';
import { MappingPanel } from '@/components/marketing/MappingPanel';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

// Direct download while the wordpress.org listing is under review. Once approved, point
// these at https://wordpress.org/plugins/jhmg-converter-for-wpbakery-to-divi/ and
// delete public/downloads/.
const FREE_PLUGIN_PATH = '/downloads/jhmg-converter-for-wpbakery-to-divi.zip';
const FREE_PLUGIN_URL = `${env.NEXT_PUBLIC_SITE_URL}${FREE_PLUGIN_PATH}`;

const PRODUCT_NAME = 'WPBakery to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert WPBakery Page Builder pages into real, validated Divi 5 layouts. The free plugin converts one page per run, straight from your site or from an export; Pro converts the whole site in one run and turns WPBakery templates into Divi Library layouts.';

// The one coverage sentence the whole page is built on, straight from
// `scripts/element-coverage.php` at the 1.0.0 release commit. Never quoted as a
// bare fraction: the parenthetical is what makes the number honest.
const groupSize = (name: string) =>
  WPBAKERY_ELEMENT_GROUPS.find((g) => g.group === name)?.elements.length ?? 0;

const TEMPLATE_ONLY_TAGS = groupSize('Template-only and vendor tags');
const ULTIMATE_ADDONS_ELEMENTS = groupSize('Ultimate Addons for WPBakery');
const RONNEBY_ELEMENTS = groupSize('Ronneby (DFD)');

const COVERAGE_LINE = `${WPBAKERY_REGISTERED_ELEMENTS}/${WPBAKERY_REGISTERED_ELEMENTS} registered WPBakery elements handled (${WPBAKERY_COVERAGE_PARENTHETICAL}), plus ${TEMPLATE_ONLY_TAGS} template-only and vendor tags`;

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'WPBakery to Divi 5 Converter: Free plugin + Pro',
  description:
    `Convert WPBakery Page Builder pages to Divi 5 in minutes. ${COVERAGE_LINE}, mapped to native, validated Divi 5 modules. Free plugin, one page per run; Pro converts whole sites and WPBakery templates, at $25/yr on unlimited sites.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/wpbakery-to-divi-5` },
};

const MAPPING_PAIRS = [
  { from: 'vc_custom_heading', to: 'divi/heading' },
  { from: 'vc_single_image', to: 'divi/image' },
  { from: 'vc_btn', to: 'divi/button' },
  { from: 'vc_tta_accordion', to: 'divi/accordion' },
  { from: 'vc_progress_bar', to: 'divi/counters' },
  { from: 'bsf-info-box', to: 'divi/blurb' },
];

// Honest mock of a real conversion report: mostly clean, two items listed for review.
const REPORT_ROWS = [
  { element: 'vc_custom_heading ×12', result: 'divi/heading', ok: true },
  { element: 'vc_single_image ×8', result: 'divi/image', ok: true },
  { element: 'vc_column_text ×15', result: 'divi/text', ok: true },
  { element: 'vc_btn ×5', result: 'divi/button (hover colours listed)', ok: false },
  { element: 'dfd_carousel ×1', result: 'static copy of the theme element, listed', ok: false },
];

const PRO_WHY = [
  {
    title: 'The whole site in one run',
    body: 'Pick every WPBakery page on the site, or upload one WordPress export, and convert them together. Free does the same work one page at a time.',
  },
  {
    title: 'WPBakery templates → Divi Library',
    body: 'Saved WPBakery templates (vc4_templates and Templatera) become Divi Library layouts instead of loose pages. Converting the same template again updates the layout instead of adding another.',
  },
  {
    title: 'Priority support + a year of updates',
    body: 'WPBakery and Divi both move fast, and every ThemeForest theme adds its own elements. Updates keep the mappings current; priority support gets you unstuck mid-migration.',
  },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Inherited a decade of WPBakery client sites. Check each page first, convert the lot in one run, and spend the saved days on review instead of rebuilds.',
  },
  {
    icon: 'storefront',
    title: 'The site owner',
    body: 'One ThemeForest theme, one move. Free plugin, page by page, zero cost. Upgrade only when the saved templates should come along.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Quotes Divi rebuilds by the page. The converter does the first 80%; the craft goes into the 20% clients actually see.',
  },
];

const FAQ = [
  {
    question: 'Do I need WPBakery Page Builder installed?',
    answer: 'Only to pick pages from the list on your site, and to have theme elements copied as static HTML rather than left as placeholders. To convert pages from another site, export them there and upload the export file; WPBakery is not needed on the Divi site.',
  },
  {
    question: 'Will this change my WPBakery pages?',
    answer: 'No. Converting always creates a new Divi draft. The original page is never modified, and every run can be undone with one click from the Recent conversions list.',
  },
  {
    question: 'Which elements convert?',
    answer: `${COVERAGE_LINE}. Structure, content, WordPress widgets and the pre-9.0 deprecated tags are all covered, and the full list is on this page.`,
  },
  {
    question: 'What happens to theme elements (Salient, Bridge, The7, Ultimate Addons)?',
    answer: `Three tiers, and nothing is ever dropped. Real handlers first: all ${WPBAKERY_REGISTERED_ELEMENTS} of WPBakery's own elements, the ${ULTIMATE_ADDONS_ELEMENTS} Ultimate Addons elements (bsf-info-box, just_icon, stat_counter, ult_content_box, ultimate_pricing, ultimate_video) and ${RONNEBY_ELEMENTS} Ronneby elements become native Divi 5 modules. Everything else your theme added is rendered with the theme active and kept as a static copy when you convert on the site that runs it. Converting from an export, where nothing can render it, leaves a labelled placeholder holding the shortcode and its text. Either way the report names the family and the count, "Ronneby x 12", rather than a list of tags nobody recognises.`,
  },
  {
    question: 'My pages were built before WPBakery 9.0. Do the old tags still work?',
    answer: 'Yes. vc_button, vc_button2, vc_cta_button, vc_tabs, vc_tour and vc_accordion are read and converted into the modern equivalent before anything else runs, and the pre-9.0 attribute spellings are normalised first, so a page from 2016 converts like a page from last week.',
  },
  {
    question: 'What about the Design Options CSS?',
    answer: 'WPBakery keeps row and element design in a generated stylesheet, and the converter reads it rule by rule: margins and padding with their tablet and phone values, backgrounds, gradients and overlays, borders, radius and shadows, typography, colours, minimum heights and responsive visibility. Anything Divi has no setting for is carried as custom CSS on the module rather than lost.',
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

function ReportRow({ element, result, ok }: { element: string; result: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <code className="font-mono text-small text-navy">{element}</code>
      <span className="flex items-center gap-2 font-mono text-small">
        {ok ? <Icon name="check" size={15} className="text-green-600" /> : <Icon name="subdirectory_arrow_right" size={15} className="text-amber-600" />}
        <span className={ok ? 'text-muted' : 'text-amber-700'}>{result}</span>
      </span>
    </li>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/wpbakery-to-divi-5`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          image: 'https://ps.w.org/jhmg-converter-for-wpbakery-to-divi/assets/banner-772x250.png',
          url,
          offer: { priceCents: 2500, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <PageHero
        align="left"
        eyebrow="WPBakery → Divi 5 Converter"
        title="Convert WPBakery to Divi 5 without rebuilding a thing."
        lead="Pick a page on your site, read the report, convert. WPBakery shortcodes become native Divi 5 modules, checked against the Divi 5 schema before anything is written, and every run can be undone. Free for one page per run; Pro moves the whole site."
      >
        <div className="flex flex-wrap items-center gap-3">
          <BuyProButton product="wpbakery-to-divi5-pro" label="Get Pro · $25/yr" />
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
            { value: `${WPBAKERY_REGISTERED_ELEMENTS}/${WPBAKERY_REGISTERED_ELEMENTS}`, label: 'registered WPBakery elements handled' },
            { value: String(WPBAKERY_ELEMENT_TYPES_MAPPED), label: 'element tags with a handler, add-ons included' },
            { value: '1 click', label: 'to undo any run' },
          ]}
        />
        <p className="mt-4 text-small text-paper/70">
          Counted by the converter&apos;s own coverage script at the release commit: {WPBAKERY_COVERAGE_PARENTHETICAL}.
        </p>
      </PageHero>

      {/* Demo: mapping panel + conversion report */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Real modules, mapped one to one</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Each WPBakery element has a dedicated converter that produces the equivalent Divi 5 module,
                content, links, images, colours, typography, spacing and backgrounds included. Sections stay
                sections, rows stay rows, and every column width, twelfths and fifths alike, lands exactly on
                Divi&apos;s grid.
              </p>
              <MappingPanel className="mt-8" fromLabel="WPBakery" toLabel="Divi 5" pairs={MAPPING_PAIRS} />
            </div>
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Check first, then convert</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Click Check this page and you get the structure the conversion will produce and everything that
                will not carry over, by name, before anything is written. Convert creates a new Divi draft; your
                WPBakery page is never touched.
              </p>
              <Card className="mt-8 p-6">
                <p className="eyebrow text-muted">Conversion report · Home</p>
                <ul className="mt-3 divide-y divide-border">
                  {REPORT_ROWS.map((r) => (
                    <ReportRow key={r.element} {...r} />
                  ))}
                </ul>
                <p className="mt-3 text-small text-muted">40 elements converted to native modules · 2 items listed for review</p>
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
              { title: 'Pick the page', body: 'Choose a WPBakery page from the list on your site, or upload a WordPress export, or a .txt file of shortcodes from another site.' },
              { title: 'Check it', body: 'Read the report: the structure the conversion will produce, and what will not carry over. Nothing has been written yet.' },
              { title: 'Convert & review', body: 'A new Divi 5 draft appears with every element native and a per-page report. Review it in the Divi Builder, publish when ready, or undo with one click.' },
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
            caption="WPBakery to Divi 5 Converter: Free vs Pro"
            columns={['Free', 'Pro · $25/yr']}
            rows={[
              { label: 'Convert pages already on your site', values: [true, true] },
              { label: 'Upload a WordPress export, or a .txt file of shortcodes', values: [true, true] },
              { label: `${WPBAKERY_ELEMENT_TYPES_MAPPED} element-tag mappings`, values: [true, true] },
              { label: 'Check-before-convert report and one-click undo', values: [true, true] },
              { label: 'Pages per run', values: ['1', 'Unlimited'] },
              { label: 'WPBakery templates → Divi Library', values: [false, true] },
              { label: 'Updates', values: ['n/a', '1 year'] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses. Renewal covers updates and support."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="wpbakery-to-divi5-pro" label="Get Pro · $25/yr" />
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

      {/* Element mapping reference */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">The full mapping reference</h2>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            All {WPBAKERY_ELEMENT_TYPES_MAPPED} element tags with a dedicated converter, straight from the
            plugin&apos;s registry. The first four groups are the {WPBAKERY_REGISTERED_ELEMENTS} tags WPBakery
            itself registers. Ultimate Addons and Ronneby are the add-on and theme families whose elements
            become real Divi 5 modules rather than a static copy. The template-only, vendor and slider tags
            mostly keep working instead of becoming one: WooCommerce&apos;s eighteen shortcodes stay inside a
            Divi code module that still runs them, and a Revolution Slider or LayerSlider deck becomes a code
            module naming the deck. Contact Form 7 and <code className="font-mono">vc_custom_field</code> are
            the two in that group that reach a Divi module of their own. Approximate mappings are marked as
            such in the report, for you to check.
          </p>
          <div className="mt-8 space-y-4">
            {WPBAKERY_ELEMENT_GROUPS.map((g) => (
              <details key={g.group} className="rounded-card border border-border bg-paper p-5 shadow-soft">
                <summary className="cursor-pointer text-body font-semibold text-navy">
                  {g.group} <span className="text-muted">({g.elements.length})</span>
                </summary>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {g.elements.map((e) => (
                    <li key={e}>
                      <code className="rounded-button bg-fog px-2 py-1 font-mono text-small text-navy">{e}</code>
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
        body="Whole WPBakery sites and saved templates, converted into validated Divi 5 markup and reviewed by you."
        cta={{ label: 'Get Pro · $25/yr', href: '/pricing' }}
        secondary={{ label: 'Try the free plugin first', href: FREE_PLUGIN_URL }}
      />
    </main>
  );
}
