import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Card } from '@/components/ui/Card';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';
import { Icon } from '@/components/ui/Icon';
import { FREE_PLUGIN_LINKS, freePluginAnchorProps } from '@/lib/site/free-downloads';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const PRODUCT_NAME = 'AI Editor for Divi 5';
const PRODUCT_DESCRIPTION =
  'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it is saved, so a broken page is never saved by an AI edit. Free plugin: edit, create pages as drafts, undo, and use the built-in image pack.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'AI Editor for Divi 5: edit Divi with AI, validated',
  description:
    'Free plugin: connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change is validated before it is saved, so a broken page is never saved by an AI edit.',
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

// What the free plugin's tools actually do (JHMG AI Editor for Divi 5 4.0.0).
// It does not set the front page, edit menus, or save custom CSS or PHP.
const FREE_CAPABILITIES = [
  {
    icon: 'manage_search',
    title: 'List, read and validate',
    body: 'See every Divi 5 page on your site, read its current layout, and check a layout against the validator without saving anything.',
  },
  {
    icon: 'edit_note',
    title: 'Update and edit surgically',
    body: 'Save a new layout once the validator approves it, or change one phone number, price or sentence without rebuilding the page.',
  },
  {
    icon: 'note_add',
    title: 'Create pages as drafts',
    body: 'New pages are always saved as drafts, so you review and publish them yourself.',
  },
  {
    icon: 'undo',
    title: 'Undo any AI edit',
    body: 'The previous version of each page the AI changes is kept (the last 10). Restore one from the plugin Dashboard, or ask your assistant to undo.',
  },
  {
    icon: 'image',
    title: 'Images built in',
    body: 'A pack of 44 original images ships with the plugin, and your assistant can look through your Media Library first. Nothing is uploaded or changed there.',
  },
  {
    icon: 'menu_book',
    title: 'Guides and section recipes',
    body: 'Style, landing-page, site and image guides plus 17 proven section recipes steer the assistant toward real, good-looking Divi 5 pages.',
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
    answer: `No layout is saved without a passing verdict: ${STATS.validatorViolationClasses} violation classes checked across ${STATS.validatorBlockTypes} Divi 5 block types. An edit either validates or it does not save, so a broken page is never saved by an AI edit. If a change passes but you do not like it, you can undo it.`,
  },
  {
    question: 'What does the validator actually check?',
    answer:
      'Block types, required attributes, attribute shapes, and nesting rules, the full Divi 5 schema, derived from real exports. Same input, same verdict, every time.',
  },
  {
    question: 'What can the free plugin do?',
    answer:
      'All of it is free. Your assistant can list and read your Divi 5 pages, validate a layout without saving, update a page or change a single piece of text, create new pages (always saved as drafts for you to review and publish), and undo any AI edit. It also includes a built-in image pack, read-only access to your Media Library, the style, landing, site and image guides, and the section recipes. It does not set your front page, edit menus, or save custom CSS or PHP.',
  },
  {
    question: 'Can I undo an AI edit?',
    answer:
      'Yes. The plugin keeps the previous version of each page the AI changes (the last 10). Restore one from the AI Editor Dashboard in wp-admin, or ask your assistant to undo.',
  },
  {
    question: 'Is there a Pro version?',
    answer:
      'Not yet. A separate Pro add-on that sources live stock photos for each section is planned. It is not built yet and has no release date. The free plugin is complete without it.',
  },
  {
    question: 'How many sites?',
    answer: 'Unlimited. Install the free plugin on every Divi 5 site you own or build for clients.',
  },
  {
    question: 'Is my site data sent to Divi5Lab?',
    answer: 'No. Your assistant talks directly to your WordPress site over its API. The plugin uses no third-party services, and we never see your content.',
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
          offer: { priceCents: 0, currency: 'USD' },
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
                passes a deterministic validator before it is saved, so a broken page is never saved by an AI
                edit. The plugin is free.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a
                  href="#free"
                  className="inline-flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
                >
                  Get the free plugin
                </a>
                <Link
                  href="/guides"
                  className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
                >
                  Read the setup guides
                </Link>
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
              { title: 'Connect', body: "Copy the connection details from the AI Editor menu in wp-admin (Settings tab) into your assistant's MCP config. Two minutes, once." },
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

      {/* What the free plugin does */}
      <SectionShell tone="paper" pad="lg" className="scroll-mt-24" id="free">
        <Container>
          <h2 className="text-h2 text-navy">What the free plugin does</h2>
          <p className="mt-3 max-w-2xl text-lead text-muted">
            Everything below is in the free plugin. This is what an AI assistant can do on your site today.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FREE_CAPABILITIES.map((c) => (
              <Card key={c.title} className="p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-button bg-fog text-action">
                  <Icon name={c.icon} size={22} />
                </div>
                <h3 className="mt-4 text-body font-semibold text-navy">{c.title}</h3>
                <p className="mt-2 text-body text-muted">{c.body}</p>
              </Card>
            ))}
          </div>
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
            <Card className="p-8">
              <h3 className="text-section text-navy">Start free</h3>
              <p className="mt-2 text-body text-muted">
                JHMG AI Editor for Divi 5 4.0.0: edit, validate and create pages (as drafts), undo AI edits, and a
                built-in image pack that also reads your Media Library. Direct download, no account needed.
              </p>
              <div className="mt-6">
                <a
                  href={FREE_PLUGIN_LINKS['ai-editor-divi5'].href}
                  {...freePluginAnchorProps(FREE_PLUGIN_LINKS['ai-editor-divi5'])}
                  className="inline-flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper transition hover:-translate-y-0.5"
                >
                  {FREE_PLUGIN_LINKS['ai-editor-divi5'].label}
                </a>
                <p className="mt-3 text-small text-muted">Version 4.0.0 · requires Divi 5, WordPress 6.0+ and PHP 8.1+. It is also pending review on wordpress.org.</p>
              </div>
            </Card>
            <Card className="border-dashed p-8">
              <p className="text-small font-semibold uppercase tracking-wide text-muted">Pro add-on: coming soon</p>
              <h3 className="mt-2 text-section text-navy">Live stock photos for each section</h3>
              <p className="mt-2 text-body text-muted">
                A separate Pro add-on is planned. It will source live stock photos for each section your
                assistant builds, with more site tools to follow. It is not available yet and has no release
                date. The free plugin stays complete without it.
              </p>
              <p className="mt-4 text-body text-navy">Want a note when it is ready?</p>
              <div className="mt-3">
                <WaitlistForm source="ai_editor_pro_waitlist" cta="Notify me" />
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
        body="The plugin is free on any Divi 5 site. Download it, connect your assistant and make your first validated edit."
        cta={{ label: 'Get the free plugin', href: '#free' }}
        secondary={{ label: 'Read the setup guides', href: '/guides' }}
      />
    </main>
  );
}
