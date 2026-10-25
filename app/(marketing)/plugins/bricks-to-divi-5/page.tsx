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
import {
  BRICKS_CORPUS_LAYOUTS,
  BRICKS_ELEMENT_GROUPS,
  BRICKS_ELEMENT_TYPES_MAPPED,
  BRICKS_STRUCTURE_ELEMENTS,
  BRICKS_WOO_ELEMENT_GROUPS,
  BRICKS_WOO_ELEMENT_TYPES_MAPPED,
} from '@/lib/site/bricks-element-mappings';
import { StatStrip } from '@/components/marketing/StatStrip';
import { MappingPanel } from '@/components/marketing/MappingPanel';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';
import { FREE_PLUGIN_LINKS } from '@/lib/site/free-downloads';

const WP_ORG_URL = FREE_PLUGIN_LINKS['bricks-to-divi5'].href;

const PRODUCT_NAME = 'Bricks to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert Bricks Builder pages into real, validated Divi 5 layouts. The free plugin converts a page at a time, straight from your site or from an export, and never touches your Bricks pages; Pro converts a whole site per run, turns Bricks headers and footers into Divi Theme Builder layouts and converts WooCommerce elements.';

// Every number on this page comes from the plugin's own registries and test corpus
// (lib/site/bricks-element-mappings.ts). Never quoted as a bare fraction of "all of
// Bricks": the element count is the elements that become a native module, and
// everything else is listed in the report instead of being dropped.
const COVERAGE_LINE = `${BRICKS_ELEMENT_TYPES_MAPPED} Bricks element types, plus sections, containers, blocks and divs, become native Divi 5 modules and layout`;

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'Bricks to Divi 5 Converter: Free plugin + Pro',
  description: `Convert Bricks Builder pages to Divi 5 in minutes. ${COVERAGE_LINE}, checked against the Divi 5 schema before anything is written. Free plugin on wordpress.org, one page per run; Pro converts whole sites, Bricks headers and footers and WooCommerce.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/bricks-to-divi-5` },
};

const MAPPING_PAIRS = [
  { from: 'heading', to: 'divi/heading' },
  { from: 'image', to: 'divi/image' },
  { from: 'button', to: 'divi/button' },
  { from: 'accordion-nested', to: 'divi/accordion' },
  { from: 'slider-nested', to: 'divi/slider' },
  { from: 'form', to: 'divi/contact-form' },
];

// Honest mock of a real conversion report: mostly clean, two items listed for review.
const REPORT_ROWS = [
  { element: 'heading ×12', result: 'divi/heading', ok: true },
  { element: 'image ×8', result: 'divi/image', ok: true },
  { element: 'button ×5', result: 'divi/button', ok: true },
  { element: 'container (CSS grid) ×1', result: 'rows and columns, grid approximated, listed', ok: false },
  { element: 'accordion-nested ×1', result: 'divi/accordion, item bodies written as markup, listed', ok: false },
];

const PRO_WHY = [
  {
    title: 'Whole sites in one run',
    body: 'The free plugin converts one page per run. Pro lifts that limit: tick every page and template you want and convert them together.',
  },
  {
    title: 'Headers and footers become real Divi layouts',
    body: 'A Bricks header or footer template is written as a Divi Theme Builder global layout, not an ordinary page. Narrow it to specific pages in Divi afterwards.',
  },
  {
    title: 'WooCommerce, converted',
    body: `${BRICKS_WOO_ELEMENT_TYPES_MAPPED} Bricks WooCommerce elements, from product pages to the multi-step checkout, become Divi WooCommerce modules. In the free plugin they are listed in the report instead.`,
  },
  {
    title: 'Your theme style CSS, applied',
    body: 'A Bricks theme style can carry its own stylesheet. The free plugin lists it in the report for you to review; Pro writes it into your site’s Additional CSS, replacing only its own block on a re-run.',
  },
  {
    title: 'A year of updates',
    body: 'Bricks and Divi both move fast. Updates keep the mappings current for the sites you have not moved yet.',
  },
  {
    title: 'Priority support',
    body: 'A real migration turns up a real site with real quirks. Priority support gets you unstuck mid-move, on as many sites as you run.',
  },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Clients on Bricks who want Divi 5. Check each page first, convert the whole site in one Pro run, and spend the saved days on review instead of rebuilds.',
  },
  {
    icon: 'storefront',
    title: 'The site owner',
    body: 'One site, one move. The free plugin converts every page, one at a time, at no cost. Upgrade only if the header, footer or shop should come along.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Quotes Divi rebuilds by the page. The converter does the first 80%, with global classes, variables and theme styles carried over; the craft goes into the 20% clients actually see.',
  },
];

const FAQ = [
  {
    question: 'Do I need Bricks installed?',
    answer:
      'No. The converter reads the page data Bricks stored in your database, or an export you upload, and never loads Bricks itself. It works with Bricks inactive or uninstalled. It does need Divi 5 active on the site you convert into.',
  },
  {
    question: 'Will this change my Bricks pages?',
    answer:
      'No. A conversion always creates a new draft page; the Bricks page it came from is never modified. Review the draft in the Divi Builder, publish it when you are happy, and delete it if you are not.',
  },
  {
    question: 'Which Bricks elements convert?',
    answer: `${COVERAGE_LINE}. Bricks sections, containers, blocks and divs become Divi sections, rows, columns and groups. The ${BRICKS_WOO_ELEMENT_TYPES_MAPPED} WooCommerce elements are converted by Pro. Any element without a Divi equivalent is named in the report; nothing is dropped in silence.`,
  },
  {
    question: 'What about global classes, variables and theme styles?',
    answer:
      'Global classes are resolved into each element’s styles. Bricks variables and colour palette entries become Divi global variables and colours, with every value resolved. Theme styles become Divi presets, so a converted button or heading still looks like the Bricks one. Custom breakpoints are mapped onto Divi’s three, including sites built mobile-first.',
  },
  {
    question: 'What does not carry over?',
    answer:
      'Things Divi cannot express are listed in the report by name. The main ones: CSS grid layouts are approximated with Divi rows and columns; Bricks components are inlined, so their reusability is lost; element conditions are not evaluated, so a conditional element is shown unconditionally; Code elements that run PHP are not converted; Divi’s slider shows one slide at a time.',
  },
  {
    question: 'What about hover states, custom CSS and interactions?',
    answer:
      'Hover states are carried as Divi hover values. An element’s own custom CSS and selector rules are carried verbatim, with Bricks’ own ids and classes kept so they still match. Bricks interactions are mapped to Divi interactions and animations where Divi has the same action; the rest are listed per interaction.',
  },
  {
    question: 'Does it handle query loops and dynamic data?',
    answer:
      'Bricks query loops are mapped onto Divi’s loop system, and the dynamic data tags Divi has an equivalent for are converted. Tags with no Divi option are listed in the report.',
  },
  {
    question: 'Does it work with Divi 4?',
    answer: 'Output is Divi 5 block markup. On a site without Divi 5 active the plugin explains itself and writes nothing.',
  },
  {
    question: 'How do I know the output is valid?',
    answer: `Every converted layout is checked against a deterministic Divi 5 validator. The converter is tested against ${BRICKS_CORPUS_LAYOUTS} real Bricks layouts, Bricks’ own template library and complete captured sites, and all of them convert to markup that passes.`,
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
    answer: 'Yes. Pro is a license that extends the free plugin. Install the free plugin from wordpress.org first, then activate Pro.',
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
      <span className="flex items-center gap-2 text-right font-mono text-small">
        {ok ? <Icon name="check" size={15} className="text-green-600" /> : <Icon name="subdirectory_arrow_right" size={15} className="text-amber-600" />}
        <span className={ok ? 'text-muted' : 'text-amber-700'}>{result}</span>
      </span>
    </li>
  );
}

/** The Pro buy button, shown only once the Stripe price exists; until then a plain note, so nobody clicks into a checkout that cannot start. */
function ProCta({ label }: { label: string }) {
  if (env.STRIPE_PRICE_BRICKS2DIVI_PRO) {
    return <BuyProButton product="bricks-to-divi5-pro" label={label} />;
  }
  return (
    <span className="inline-flex h-12 items-center rounded-pill border border-paper/35 bg-paper/10 px-6 text-body font-semibold text-paper/90">
      Pro opens shortly · $25/yr
    </span>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/bricks-to-divi-5`;
  const proOnSale = Boolean(env.STRIPE_PRICE_BRICKS2DIVI_PRO);

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          image: 'https://ps.w.org/jhmg-converter-for-bricks-to-divi-5/assets/banner-772x250.jpg',
          url,
          offer: { priceCents: 2500, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <PageHero
        align="left"
        eyebrow="Bricks → Divi 5 Converter"
        title="Convert Bricks to Divi 5 without rebuilding a thing."
        lead="Pick a page on your site, read the report, convert. Bricks elements become native Divi 5 modules, checked against the Divi 5 schema before anything is written, and your Bricks page is never touched. Free on wordpress.org for one page per run; Pro converts whole sites, Bricks headers and footers and WooCommerce."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ProCta label="Get Pro · $25/yr" />
          <a
            href={WP_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
          >
            Get the free plugin on wordpress.org
          </a>
        </div>
        <p className="mt-3 text-small text-paper/70">
          Free in the WordPress plugin directory. Install it from Plugins → Add New and search for “Bricks to Divi 5”.
        </p>
        <StatStrip
          className="mt-12 !mx-0"
          tone="dark"
          stats={[
            { value: String(BRICKS_ELEMENT_TYPES_MAPPED), label: 'Bricks element types converted to native modules' },
            { value: String(BRICKS_WOO_ELEMENT_TYPES_MAPPED), label: 'WooCommerce element types in Pro' },
            { value: String(BRICKS_CORPUS_LAYOUTS), label: 'real Bricks layouts converted and validated in testing' },
          ]}
        />
        <p className="mt-4 text-small text-paper/70">
          Counted from the converter&apos;s own element registry. Sections, containers, blocks and divs become Divi sections,
          rows, columns and groups; anything without a Divi equivalent is listed in the report.
        </p>
      </PageHero>

      {/* Demo: mapping panel + conversion report */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Real modules, mapped one to one</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Each Bricks element has a dedicated converter that produces the equivalent Divi 5 module, with its
                content, links, images, colours, typography, spacing, backgrounds and hover states. Global classes,
                variables and theme styles come along, so the converted page looks like the Bricks one and stays
                editable in Divi.
              </p>
              <MappingPanel className="mt-8" fromLabel="Bricks" toLabel="Divi 5" pairs={MAPPING_PAIRS} />
            </div>
            <div className="min-w-0">
              <h2 className="text-h2 text-navy">Check first, then convert</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Click Preview and you get the structure the conversion will produce and everything that will not
                carry over, by name, before anything is written. Convert then creates a new draft page in Divi 5 and
                leaves the Bricks page exactly as it was.
              </p>
              <Card className="mt-8 p-6">
                <p className="eyebrow text-muted">Conversion report · Home</p>
                <ul className="mt-3 divide-y divide-border">
                  {REPORT_ROWS.map((r) => (
                    <ReportRow key={r.element} {...r} />
                  ))}
                </ul>
                <p className="mt-3 text-small text-muted">25 elements converted to native modules · 2 items listed for review</p>
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
              { title: 'Pick the page', body: 'Choose a Bricks page or template from the list on your site, or upload a WordPress export or a single Bricks template file from another site.' },
              { title: 'Preview it', body: 'Read the report: the structure the conversion will produce, what will not carry over, and any variable or colour that could not be resolved. Nothing has been written yet.' },
              { title: 'Convert & review', body: 'A new draft page comes back built in Divi 5, every element native. Review it in the Divi Builder and publish when you are happy. The Bricks page is untouched.' },
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
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            caption="Bricks to Divi 5 Converter: Free vs Pro"
            columns={['Free', 'Pro · $25/yr']}
            rows={[
              { label: 'Convert pages already on your site', values: [true, true] },
              { label: 'Upload a WordPress export or a Bricks template file', values: [true, true] },
              { label: `${BRICKS_ELEMENT_TYPES_MAPPED} element types converted to native modules`, values: [true, true] },
              { label: 'Global classes, variables and theme styles carried over', values: [true, true] },
              { label: 'Preview report before anything is written', values: [true, true] },
              { label: 'Pages per run', values: ['1', 'Unlimited'] },
              { label: 'Bricks headers and footers → Divi Theme Builder layouts', values: [false, true] },
              { label: `${BRICKS_WOO_ELEMENT_TYPES_MAPPED} WooCommerce elements → Divi WooCommerce modules`, values: [false, true] },
              { label: 'Theme style stylesheet applied to Additional CSS', values: ['Listed in the report', true] },
              { label: 'Updates', values: ['n/a', '1 year'] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses. Renewal covers updates and support."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {proOnSale ? (
              <BuyProButton product="bricks-to-divi5-pro" label="Get Pro · $25/yr" />
            ) : (
              <span className="text-body font-semibold text-navy">Pro opens shortly · $25/yr</span>
            )}
            <a href={WP_ORG_URL} target="_blank" rel="noopener noreferrer" className="text-body font-semibold text-action hover:underline">
              Start with the free plugin
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
            All {BRICKS_ELEMENT_TYPES_MAPPED} element types in the free plugin, and the {BRICKS_WOO_ELEMENT_TYPES_MAPPED}{' '}
            WooCommerce element types in Pro, straight from the plugin&apos;s registry. Bricks&apos; layout elements (
            {BRICKS_STRUCTURE_ELEMENTS.map((e, i) => (
              <span key={e}>
                {i > 0 ? ', ' : ''}
                <code className="font-mono">{e}</code>
              </span>
            ))}
            ) become Divi sections, rows, columns and groups. Some mappings are approximate, for example the Code
            element becomes a Divi Code module that shows the source as text and never runs it; those are marked in
            the report for you to check.
          </p>
          <div className="mt-8 space-y-4">
            {BRICKS_ELEMENT_GROUPS.map((g) => (
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
            <h3 className="pt-4 text-section text-navy">WooCommerce, with Pro</h3>
            {BRICKS_WOO_ELEMENT_GROUPS.map((g) => (
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
        body="Bricks pages, headers, footers and shops, converted into validated Divi 5 markup and reviewed by you."
        cta={{ label: proOnSale ? 'Get Pro · $25/yr' : 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Try the free plugin first', href: WP_ORG_URL }}
      />
    </main>
  );
}
