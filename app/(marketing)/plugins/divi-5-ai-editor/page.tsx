import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Card } from '@/components/ui/Card';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { FreeDownloadForm } from '@/components/plugins/FreeDownloadForm';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const PRODUCT_NAME = 'AI Editor for Divi 5';
const PRODUCT_DESCRIPTION =
  'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database, so broken layouts are impossible. Free tier edits existing pages; Pro unlocks page creation, menus, and site-wide styling.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'AI Editor for Divi 5: edit Divi with AI, validated',
  description:
    'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database, so broken layouts are impossible.',
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-5-ai-editor` },
};

const DEMO_STEPS: ChatStep[] = [
  { role: 'user', text: 'Add a three-column pricing section under the hero on the Services page.' },
  { role: 'assistant', text: 'get_section_recipes(type: "pricing") → update_page_layout(page: "Services", …)' },
  { role: 'validator-fail', text: 'WRONG_FIELD_TYPE: divi/pricing-tables “featured” must be an object, got boolean' },
  { role: 'assistant', text: 'Correcting the attribute shape from the violation, re-submitting…' },
  { role: 'validator-pass', text: 'Valid. 21 blocks, 0 violations. Saved to “Services”.' },
];

const ASSISTANTS = ['Claude Desktop', 'Claude Code', 'Cursor', 'Windsurf', 'VS Code Copilot', 'ChatGPT (Actions)'];

const USE_CASES = [
  {
    icon: 'edit_note',
    title: 'The content editor',
    body: 'Updates hero copy, swaps testimonials, adjusts CTAs, all in chat, without opening the builder or fearing the layout.',
  },
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Ships client change requests from the assistant they already pay for. The validator is the QA step that never sleeps.',
  },
  {
    icon: 'terminal',
    title: 'The developer',
    body: 'Automates page assembly from specs via MCP. Deterministic verdicts make AI output safe to pipeline.',
  },
];

const FAQ = [
  {
    question: 'Which AI assistants work?',
    answer:
      'Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code Copilot connect via MCP. ChatGPT connects via OpenAPI actions. Any HTTP client can call the API directly.',
  },
  {
    question: 'Do I need an AI subscription?',
    answer:
      'Yes, bring your own assistant. The plugin adds the tools and the safety net (the validator); your assistant supplies the AI.',
  },
  {
    question: 'Can the AI break my site?',
    answer: `No layout reaches your database without a passing verdict: ${STATS.validatorViolationClasses} violation classes checked across ${STATS.validatorBlockTypes} Divi 5 block types. An edit either validates or it doesn't save.`,
  },
  {
    question: 'What does the validator actually check?',
    answer:
      'Block types, required attributes, attribute shapes, and nesting rules, the full Divi 5 schema, derived from real exports. Same input, same verdict, every time.',
  },
  {
    question: 'What can the free version do?',
    answer:
      'Read and update existing pages, dry-run validation, and all the guides (style, landing, image, site) plus section recipes. Pro adds page creation, menus, front-page control, site-wide CSS, and reviewed PHP proposals.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Premium features keep working on sites where Pro is already activated. Renewal covers updates and support.',
  },
  {
    question: 'How many sites?',
    answer: 'Unlimited. One Pro license activates on as many sites as you own or build for clients.',
  },
  {
    question: 'Is my site data sent to Divi5Lab?',
    answer: 'No. Your assistant talks directly to your WordPress site over its API. We never see your content; the license server only checks activation.',
  },
];

export default function AiEditorPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/divi-5-ai-editor`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          url,
          offer: { priceCents: 3000, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero + demo */}
      <SectionShell tone="hero" underHeader bottom="lg" blooms curveBottom={EDGE.paper}>
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow tone="dark" className="mb-4">AI Editor for Divi 5</Eyebrow>
              <h1 className="text-h1 text-paper">The AI Editor for Divi 5</h1>
              <p className="mt-6 max-w-xl text-lead text-paper/80">
                Connect Claude, Cursor, or ChatGPT to your site and edit pages in plain English. Every change
                passes a deterministic validator before it touches your database, so broken layouts are impossible.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <BuyProButton product="ai-editor-divi5-pro" label="Start 45-day free trial" />
                <a
                  href="#free"
                  className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
                >
                  Try it free
                </a>
              </div>
              <p className="mt-6 text-small font-medium text-paper/60">
                Works with: {ASSISTANTS.join(' · ')}
              </p>
            </div>
            <ValidatorChatDemo steps={DEMO_STEPS} className="animate-float" />
          </div>
        </Container>
      </SectionShell>

      {/* The safety mechanism */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-action">Why it&apos;s safe</p>
            <h2 className="mt-3 text-h2 text-navy">AI drafts. The validator decides.</h2>
            <p className="mt-4 text-lead text-muted">
              Language models are confident even when they&apos;re wrong, so we never trust one with your database.
              Every proposed layout is checked block by block against the real Divi 5 schema. Invalid edits bounce
              back with exact violation codes, and the assistant fixes its own mistake before you ever see it.
            </p>
          </div>
          <StatStrip
            className="mt-12"
            stats={[
              { value: String(STATS.validatorBlockTypes), label: 'Divi 5 block types modeled' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
              { value: '100%', label: 'of saves validated first' },
            ]}
          />
        </Container>
      </SectionShell>

      {/* How it works */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Three steps to your first AI edit</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { title: 'Connect', body: "Paste the API key from the AI Editor menu in wp-admin into your assistant's MCP config. Two minutes, once." },
              { title: 'Instruct', body: '“Change the hero heading on Home to…”, describing the change the way you would to a colleague.' },
              { title: 'Validated & saved', body: 'The validator checks every block, attribute, and nesting rule. Invalid? Exact violations come back and the AI self-corrects.' },
            ].map((s, i) => (
              <Card key={s.title} className="p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* Free vs Pro */}
      <SectionShell tone="paper" pad="lg" className="scroll-mt-24" id="free">
        <Container>
          <h2 className="text-h2 text-navy">What your assistant can do, today vs. with Pro</h2>
          <ComparisonTable
            className="mt-8"
            caption="AI Editor for Divi 5: Free vs Pro"
            columns={['Free', 'Pro · $30/yr']}
            rows={[
              { label: 'List pages & read layouts', values: [true, true] },
              { label: 'Update existing pages', values: [true, true] },
              { label: 'Dry-run validation', values: [true, true] },
              { label: 'Style, landing, image & site guides', values: [true, true] },
              { label: 'Section recipes', values: [true, true] },
              { label: 'Create pages from scratch', values: [false, true] },
              { label: 'Set the front page', values: [false, true] },
              { label: 'Build the primary menu', values: [false, true] },
              { label: 'Site-wide custom CSS', values: [false, true] },
              { label: 'Reviewed PHP proposals', values: [false, true] },
              { label: 'Updates & support', values: ['n/a', 'WP-native updates + priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses. Renewal covers updates and support."
          />
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
            <Card className="p-8">
              <h3 className="text-section text-navy">Start free</h3>
              <p className="mt-2 text-body text-muted">Edit and validate existing pages, all guides included. Direct download, no account needed.</p>
              <div className="mt-6">
                <FreeDownloadForm product="ai-editor-divi5-pro" />
              </div>
            </Card>
            <Card className="relative border-action p-8 shadow-lg ring-1 ring-action">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-action px-4 py-1.5 text-small font-semibold text-paper shadow-glow">
                One license, unlimited sites
              </span>
              <h3 className="text-section text-navy">Go Pro</h3>
              <p className="mt-2 text-body text-muted">
                Whole-page creation, menus, front-page control, and site-wide styling: the full toolset for
                building with AI, not just editing.
              </p>
              <div className="mt-6">
                <BuyProButton product="ai-editor-divi5-pro" label="Start 45-day free trial" />
              </div>
            </Card>
          </div>
        </Container>
      </SectionShell>

      {/* Use cases */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Who edits with it</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
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
        title="Your assistant already knows Divi. Now it can prove it."
        body="Free to try on any Divi 5 site. Pro when you want it building pages, menus, and site-wide styles."
        cta={{ label: 'Start 45-day free trial', href: '/pricing' }}
        secondary={{ label: 'Read the setup guides', href: '/guides' }}
      />
    </main>
  );
}
