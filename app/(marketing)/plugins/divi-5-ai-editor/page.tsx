import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Card } from '@/components/ui/Card';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { Icon } from '@/components/ui/Icon';
import { FREE_PLUGIN_LINKS, freePluginAnchorProps } from '@/lib/site/free-downloads';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';
import { PRICING, OFFER, formatUsd, lowestTier, siteLabel } from '@/lib/pricing/config';

const PRODUCT_NAME = 'AI Editor for Divi 5';
const PRODUCT_DESCRIPTION =
  'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it is saved, so a broken page is never saved by an AI edit. Free plugin with 16 tools, Pro add-on with 14 advanced tools from ' + formatUsd(lowestTier().priceCents) + '/year.';

export const metadata: Metadata = {
  title: 'AI Editor for Divi 5: edit Divi with AI, validated',
  description:
    `Free plugin: connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change is validated before it is saved. Pro add-on adds 14 site-wide tools from ${formatUsd(lowestTier().priceCents)}/yr.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-5-ai-editor` },
};

const DEMO_STEPS: ChatStep[] = [
  { role: 'user', text: 'Add a three-column pricing section under the hero on the Services page.' },
  { role: 'assistant', text: 'get_section_recipes(type: "pricing") → update_page_layout(page: "Services", …)' },
  { role: 'validator-fail', text: 'WRONG_FIELD_TYPE: divi/pricing-tables "featured" must be an object, got boolean' },
  { role: 'assistant', text: 'Correcting the attribute shape from the violation, re-submitting…' },
  { role: 'validator-pass', text: 'Valid. 21 blocks, 0 violations. Saved to "Services".' },
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

const PRO_CAPABILITIES = [
  {
    icon: 'home_work',
    title: 'Set the front page and menu',
    body: 'Publish pages and assign them as your site front page or add them to the primary menu, all from chat.',
  },
  {
    icon: 'palette',
    title: 'Manage CSS and code',
    body: 'Add custom CSS (clearly marked), or store PHP proposals for you to review. The plugin never runs code.',
  },
  {
    icon: 'layers',
    title: 'Edit headers and footers',
    body: 'Edit your live Divi Theme Builder header and footer layouts with the same validation and undo as pages.',
  },
  {
    icon: 'find_replace',
    title: 'Find and replace site-wide',
    body: 'Replace text across your Divi 5 pages, headers and footers (with permission) as one undoable batch.',
  },
  {
    icon: 'fact_check',
    title: 'Audit your site',
    body: 'Read-only check for layout problems, unknown preset or color ids, and internal links to missing or unpublished pages.',
  },
  {
    icon: 'rocket_launch',
    title: 'Build and launch whole sites',
    body: 'Add multiple pages as one batch, set the menu and front page, and launch everything in one undoable step.',
  },
];

const FAQ = [
  {
    question: 'Which AI assistants work?',
    answer:
      'Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code Copilot connect via MCP. ChatGPT connects via OpenAPI actions. Any HTTP client can call the REST API directly.',
  },
  {
    question: 'Do I need to bring my own AI?',
    answer:
      'Yes. The plugin adds the tools and the safety net (the deterministic validator); you bring your assistant (Claude, ChatGPT, Cursor, etc.).',
  },
  {
    question: 'Can the AI break my site?',
    answer: `No layout is saved without a passing verdict: ${STATS.validatorViolationClasses} violation classes checked across ${STATS.validatorBlockTypes} Divi 5 block types. An edit either validates or it does not save, so a broken page is never saved by an AI edit. If a change passes but you do not like it, you can undo it.`,
  },
  {
    question: 'What does the validator actually check?',
    answer:
      'Block types, required attributes, attribute shapes, and nesting rules: the full Divi 5 schema, derived from real exports. Same input, same verdict, every time.',
  },
  {
    question: 'What can the free plugin do?',
    answer:
      'Your assistant can list and read your Divi 5 pages, validate a layout without saving, update a page or change a single piece of text, create new pages (always saved as drafts for you to review and publish), and undo any AI edit. It also includes a built-in image pack, read-only access to your Media Library, the style, landing, site and image guides, and the section recipes. It does not set your front page, edit menus, or save custom CSS or PHP. All 16 free tools work on unlimited sites.',
  },
  {
    question: 'What does the Pro add-on add?',
    answer:
      'Fourteen advanced tools: set the front page and primary menu, publish pages, add custom CSS and PHP proposals, edit live Divi headers and footers, find and replace text site-wide, audit for problems and broken links, and build a whole Divi 5 site as one undoable batch. Every change is undoable.',
  },
  {
    question: 'How much does the Pro add-on cost?',
    answer:
      `${PRICING.tiers.map((t) => `${t.label} (${siteLabel(t).toLowerCase()}): ${formatUsd(t.priceCents)}/year`).join('. ')}. Trial: ${OFFER.trialDays} days free${PRICING.trial.requireCard ? '' : ', no credit card'}. Current offers are on the pricing page.`,
  },
  {
    question: 'What happens when my license expires?',
    answer:
      `Pro keeps working on every site where it is already activated. You just stop receiving new updates and support until you renew. No hostage access. Renewal reminders are sent ${PRICING.renewalReminderDays.join(' and ')} days before your renewal.`,
  },
  {
    question: 'Can I undo a Pro change?',
    answer:
      'Yes. Every Pro tool records its changes as a batch with an undo point. One call to undo_batch restores everything safely (or tells you what could not be undone because it changed afterwards).',
  },
  {
    question: 'Do licenses cover client sites?',
    answer:
      `Yes. A licence covers as many sites as its tier allows, whether they are your own or your clients'. ${PRICING.tiers.filter((t) => t.sites === null).map((t) => t.label).join(' and ')} cover unlimited sites.`,
  },
  {
    question: 'Is the plugin GPL?',
    answer:
      'Yes, both free and Pro. The GPL keeps the code open; the licence pays for updates and support. You can review the code, modify it for your own use, and read it without any restrictions.',
  },
  {
    question: 'Are the layouts really free?',
    answer: 'Yes. Every layout in our catalog is free to download. Drop your email and grab as many as you like.',
  },
  {
    question: 'Is my site data sent to Divi5Lab?',
    answer: 'Your content is not. Your assistant talks directly to your WordPress site over its API, and neither plugin sends your pages anywhere. The free plugin makes no remote calls at all. The Pro add-on contacts divi5lab.com only to check your licence and look for updates, and sends your licence key, site address, plugin version and WordPress version to do so.',
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
      <JsonLd
        data={productJsonLd({
          name: `${PRODUCT_NAME} Pro`,
          description: `The Pro add-on: 14 site-wide tools for ${PRODUCT_NAME}. Annual licence by number of sites.`,
          url,
          offer: { priceCents: lowestTier().priceCents, currency: PRICING.currency },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero + demo */}
      <SectionShell tone="hero" underHeader bottom="lg" blooms curveBottom={EDGE.paper}>
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow tone="dark" className="mb-4">AI Editor for Divi 5</Eyebrow>
              <h1 className="text-h1 text-paper">Edit Divi 5 in plain English, validated</h1>
              <p className="mt-6 max-w-xl text-lead text-paper/80">
                Connect Claude, Cursor, or ChatGPT to your site and edit pages in plain English. Every change
                passes a deterministic validator before it is saved, so a broken page is never saved by an AI
                edit. Free plugin with 16 tools, or upgrade to Pro for site-wide features.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a
                  href="#free"
                  className="inline-flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
                >
                  Get the free plugin
                </a>
                <Link
                  href="/pricing"
                  className="inline-flex h-12 items-center justify-center rounded-pill border border-paper/35 bg-paper/10 px-8 text-body font-semibold text-paper backdrop-blur transition hover:-translate-y-0.5 hover:border-paper/70 hover:bg-paper/20"
                >
                  See Pro pricing
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
            <p className="eyebrow text-action">Why it is safe</p>
            <h2 className="mt-3 text-h2 text-navy">AI drafts. The validator decides.</h2>
            <p className="mt-4 text-lead text-muted">
              Language models are confident even when they are wrong, so we never trust one with your database.
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
              { title: 'Instruct', body: '"Change the hero heading on Home to …", describing the change the way you would to a colleague.' },
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
          <h2 className="text-h2 text-navy">Free plugin: 16 tools</h2>
          <p className="mt-3 max-w-2xl text-lead text-muted">
            Everything below is in the free plugin. Your assistant can do all of this on any Divi 5 site.
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
              <h3 className="text-section text-navy">Download and install free</h3>
              <p className="mt-2 text-body text-muted">
                JHMG AI Editor for Divi 5: all 16 tools included, no features locked, no credit card, no account needed. Install on one site or a hundred.
              </p>
              <div className="mt-6">
                <a
                  href={FREE_PLUGIN_LINKS['ai-editor-divi5'].href}
                  {...freePluginAnchorProps(FREE_PLUGIN_LINKS['ai-editor-divi5'])}
                  className="inline-flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper transition hover:-translate-y-0.5"
                >
                  {FREE_PLUGIN_LINKS['ai-editor-divi5'].label}
                </a>
                <p className="mt-3 text-small text-muted">Requires Divi 5, WordPress 6.0+ and PHP 8.1+</p>
              </div>
            </Card>
            <Card className="border-dashed p-8">
              <p className="text-small font-semibold uppercase tracking-wide text-muted">Pro add-on: 14 site-wide tools</p>
              <h3 className="mt-2 text-section text-navy">AI Editor for Divi 5 Pro</h3>
              <p className="mt-2 text-body text-muted">
                Set your front page and menu, publish pages, add CSS, manage your live header and footer, find and replace across your site, audit for problems, and build whole sites as one undoable batch.
              </p>
              <p className="mt-4 text-body text-navy">Plans from {formatUsd(lowestTier().priceCents)}/year. Try free for {OFFER.trialDays} days{PRICING.trial.requireCard ? '' : ', no credit card'}.</p>
              <div className="mt-6">
                <Link
                  href="/pricing"
                  className="inline-flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper transition hover:-translate-y-0.5"
                >
                  See Pro pricing
                </Link>
              </div>
            </Card>
          </div>
        </Container>
      </SectionShell>

      {/* Pro capabilities */}
      <SectionShell tone="mist" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Pro add-on: 14 advanced tools</h2>
          <p className="mt-3 max-w-2xl text-lead text-muted">
            Unlock site-wide editing and automation. Try free for {OFFER.trialDays} days.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRO_CAPABILITIES.map((c) => (
              <Card key={c.title} className="p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-button bg-fog text-action">
                  <Icon name={c.icon} size={22} />
                </div>
                <h3 className="mt-4 text-body font-semibold text-navy">{c.title}</h3>
                <p className="mt-2 text-body text-muted">{c.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </SectionShell>

      {/* Use cases */}
      <SectionShell tone="paper" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Who uses it</h2>
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
        title="Your assistant already knows Divi. Now it can edit it safely."
        body={`Free plugin with 16 tools, Pro add-on with 14 more. ${PRICING.trial.requireCard ? '' : `No credit card for the free version or the ${OFFER.trialDays}-day trial.`}`}
        cta={{ label: 'Get the free plugin', href: '#free' }}
        secondary={{ label: `Try Pro free for ${OFFER.trialDays} days`, href: '/pricing' }}
      />
    </main>
  );
}
