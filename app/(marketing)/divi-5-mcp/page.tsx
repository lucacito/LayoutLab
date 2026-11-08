import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd, breadcrumbJsonLd, softwareApplicationJsonLd } from '@/lib/seo/jsonld';
import { organizationId } from '@/lib/seo';
import { StatStrip } from '@/components/marketing/StatStrip';
import { CtaBand } from '@/components/marketing/CtaBand';
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase';
import { TestimonialBand } from '@/components/marketing/TestimonialBand';
import { AI_EDITOR } from '@/lib/site/ai-editor-facts';
import { MARVA_LORD_ON_CONTROL } from '@/lib/site/testimonials';
import { FREE_PLUGIN_LINKS, freePluginAnchorProps } from '@/lib/site/free-downloads';

const URL_PATH = '/divi-5-mcp';
const TITLE = 'Divi 5 MCP Server: connect Claude, ChatGPT and Cursor';
const DESCRIPTION =
  'The free MCP server for Divi 5. Connect Claude, ChatGPT, Cursor or VS Code Copilot to your WordPress site and read, edit and build Divi 5 pages in plain English, with every change validated and undoable.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}${URL_PATH}` },
  openGraph: { type: 'website', url: `${env.NEXT_PUBLIC_SITE_URL}${URL_PATH}`, title: TITLE, description: DESCRIPTION },
};

const CLIENTS: { name: string; how: string; guide?: string }[] = [
  { name: 'Claude Desktop and Claude Code', how: 'Connect over MCP with the address and key from the plugin settings.', guide: '/guides/connect-claude-to-divi-5' },
  { name: 'Claude on the web', how: 'Optional OAuth sign-in for claude.ai custom connectors: no Node.js to install. Off until you turn it on.', guide: '/guides/connect-claude-to-divi-5' },
  { name: 'Cursor', how: 'Add the server to Cursor\'s MCP settings and edit pages from your editor.', guide: '/guides/connect-cursor-to-divi-5' },
  { name: 'Windsurf and VS Code Copilot', how: 'Any MCP client that supports a remote HTTP server can connect with the same details.' },
  { name: 'ChatGPT', how: 'Connects as a custom MCP connector that signs in with your WordPress login. It needs a paid ChatGPT plan with Developer mode, and is not yet confirmed with a real ChatGPT account.', guide: '/guides/connect-chatgpt-to-divi-5' },
  { name: 'Anything else', how: 'A REST API with the same tools serves scripts and any other HTTP client.' },
];

const FAQ = [
  {
    question: 'What is an MCP server for Divi 5?',
    answer:
      'MCP (Model Context Protocol) is the open standard that lets an AI assistant use tools. An MCP server for Divi 5 gives the assistant tools to list, read, check, edit and create Divi 5 pages on your own WordPress site. The AI Editor for Divi 5 plugin turns your site into that server.',
  },
  {
    question: 'Is the Divi 5 MCP server free?',
    answer: `Yes. The plugin is free on WordPress.org with ${AI_EDITOR.freeTools} tools, and nothing in it is locked. A separate Pro add-on adds ${AI_EDITOR.proTools} more tools for work across the whole site. You bring your own AI assistant, so there are no AI credits to run out.`,
  },
  {
    question: 'Which AI assistants can connect?',
    answer:
      'Claude Desktop, Claude Code and Claude on the web, Cursor, Windsurf and VS Code Copilot connect over MCP. ChatGPT connects as a custom MCP connector (not yet confirmed with a real ChatGPT account). Anything that can call an HTTP API can use the REST API.',
  },
  {
    question: 'Can the AI break my Divi 5 site?',
    answer: `A layout is only saved when it passes a deterministic validator that checks ${AI_EDITOR.blockTypes} Divi 5 block types, so a broken page is never saved by an AI edit. New pages are always drafts, you can preview any change first, and the previous version of each page is kept so you can undo.`,
  },
  {
    question: 'Does Divi have its own MCP?',
    answer:
      'Divi has announced one, and it is not released yet, so this plugin has not been tested against it. The AI Editor is designed to work alongside it: the design guidance, the validator check and the undo are offered as WordPress abilities that any AI can call, whichever tool builds the page.',
  },
  {
    question: 'Does it work with Divi 4 or other page builders?',
    answer:
      'It is built for Divi 5 only, because it checks Divi 5\'s own block format. For moving a site from another builder, Divi5Lab also has converters from Elementor, Beaver Builder and WPBakery to Divi 5.',
  },
  {
    question: 'Is my content sent to Divi5Lab?',
    answer:
      'No. Your assistant talks directly to your WordPress site, and the free plugin makes no remote calls at all. The Pro add-on contacts divi5lab.com only to check your licence and look for updates.',
  },
];

export default function Divi5McpPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}${URL_PATH}`;
  const free = FREE_PLUGIN_LINKS['ai-editor-divi5'];

  return (
    <main>
      <JsonLd
        data={softwareApplicationJsonLd({
          name: 'AI Editor for Divi 5 (MCP server)',
          description: DESCRIPTION,
          url,
          version: AI_EDITOR.freeVersion,
          downloadUrl: AI_EDITOR.wordpressOrgUrl,
          requirements: 'WordPress 6.0+, Divi 5, PHP 8.1+',
          featureList: ['MCP server for Divi 5', 'Deterministic layout validator', 'Preview before saving', 'Undo for AI edits', 'Divi 5 Loop Builder support', 'Section patterns, design languages and style kits'],
          publisherId: organizationId(site),
          offer: { priceCents: 0, currency: 'USD' },
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Divi5Lab', url: site }, { name: 'Divi 5 MCP server', url }])} />
      <JsonLd data={faqJsonLd(FAQ)} />

      <SectionShell tone="hero" underHeader bottom="lg" blooms curveBottom={EDGE.paper}>
        <Container className="text-center">
          <Eyebrow tone="dark" className="mb-5">Model Context Protocol</Eyebrow>
          <h1 className="mx-auto max-w-4xl text-display text-paper">The MCP server for Divi 5.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lead text-paper/80">
            Connect Claude, ChatGPT, Cursor or VS Code Copilot to your own WordPress site and let them read, edit and build Divi 5 pages in plain
            English. A fixed validator checks every change before it is saved, so the AI can be creative and the layout stays valid.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href={free.href}
              {...freePluginAnchorProps(free)}
              className="inline-flex h-14 items-center justify-center rounded-pill bg-action px-9 text-body font-semibold text-paper shadow-glow transition hover:-translate-y-0.5"
            >
              Get the free plugin
            </a>
            <Button href="#features" size="lg" variant="onDark">See every tool</Button>
          </div>
          <p className="mt-5 text-small text-paper/70">Free on WordPress.org · Requires Divi 5, WordPress 6.0+ and PHP 8.1+ · Tested on Divi {AI_EDITOR.testedDivi}</p>
          <StatStrip
            className="mt-14"
            tone="dark"
            stats={[
              { value: String(AI_EDITOR.freeTools), label: 'free MCP tools' },
              { value: String(AI_EDITOR.proTools), label: 'more in Pro' },
              { value: String(AI_EDITOR.blockTypes), label: 'Divi 5 block types checked' },
              { value: String(AI_EDITOR.sectionPatterns), label: 'proven section patterns' },
            ]}
          />
        </Container>
      </SectionShell>

      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Eyebrow>Why it matters</Eyebrow>
            <h2 className="mt-4 text-h2 text-navy">An AI that can touch your pages needs a gatekeeper.</h2>
            <p className="mt-5 text-lead text-muted">
              Language models are confident even when they are wrong, and Divi 5 stores pages as precise block markup. A wrong attribute can leave
              a section collapsed, and a few wrong shapes make Divi fail the whole page for every visitor. So the plugin never trusts the model
              with the database: every proposed layout is checked against the real Divi 5 schema, and a refusal names the exact setting to fix
              so the assistant corrects itself before you see it.
            </p>
            <p className="mt-4 text-lead text-muted">
              The check is not a second AI. The same layout always gets the same verdict, and the rules come from real Divi 5 exports and live renders.
            </p>
          </div>
        </Container>
      </SectionShell>

      <SectionShell tone="mist" pad="lg">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Connect</Eyebrow>
            <h2 className="mt-4 text-h2 text-navy">Use the assistant you already pay for</h2>
          </div>
          <ul className="mt-12 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
            {CLIENTS.map((c) => (
              <li key={c.name}>
                <Card className="h-full p-7">
                  <h3 className="text-section text-navy">{c.name}</h3>
                  <p className="mt-3 text-body text-muted">{c.how}</p>
                  {c.guide && (
                    <Link href={c.guide} className="mt-4 inline-block text-small font-semibold text-action hover:underline">
                      Setup guide
                    </Link>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </SectionShell>

      <FeatureShowcase />

      <TestimonialBand items={[MARVA_LORD_ON_CONTROL]} eyebrow="From a designer who uses it" title="Careful, controlled work on a client's own site." />

      <SectionShell tone="paper" pad="lg">
        <Container>
          <h2 className="text-h2 text-navy">Divi 5 MCP questions</h2>
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
        title="Give your assistant Divi 5, with a safety net."
        body={`Free plugin with ${AI_EDITOR.freeTools} tools. Pro adds ${AI_EDITOR.proTools} more for the whole site.`}
        cta={{ label: 'See the plugin', href: '/plugins/divi-5-ai-editor' }}
        secondary={{ label: 'Pro pricing', href: '/pricing' }}
        curveTop={EDGE.paper}
      />
    </main>
  );
}
