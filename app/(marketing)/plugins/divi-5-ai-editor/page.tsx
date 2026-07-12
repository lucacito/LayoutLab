import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { FreeDownloadForm } from '@/components/plugins/FreeDownloadForm';

const PRODUCT_NAME = 'AI Editor for Divi 5';
const PRODUCT_DESCRIPTION =
  'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database — broken layouts are impossible. Free tier edits existing pages; Pro unlocks page creation, menus, and site-wide styling.';

export const metadata: Metadata = {
  // No "| Divi5Lab" suffix here — the root layout's `title.template` already
  // appends it (see app/layout.tsx), matching every other marketing page.
  title: 'AI Editor for Divi 5 — edit Divi with AI, validated',
  description:
    'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database — broken layouts are impossible.',
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-5-ai-editor` },
};

const STEPS = [
  {
    title: 'Connect',
    body: "Paste the API key from the AI Editor menu in wp-admin into your assistant's MCP config.",
  },
  {
    title: 'Instruct',
    body: '"Change the hero heading on Home to…" — describe the change in plain English.',
  },
  {
    title: 'Validated & saved',
    body: 'The validator checks every block, attribute, and nesting rule. Invalid? Exact violations come back and the AI self-corrects.',
  },
];

const FREE_TOOLS = [
  'List pages',
  'Read layouts',
  'Dry-run validate',
  'Update existing pages',
  'Style, landing, image & site guides',
  'Section recipes',
];

const PRO_TOOLS = [
  'Create pages from scratch',
  'Set the front page',
  'Build the primary menu',
  'Site-wide custom CSS',
  'Reviewed PHP proposals',
];

const FAQ = [
  {
    question: 'Which AI assistants work?',
    answer:
      'Claude Desktop, Cursor, Windsurf, and VS Code Copilot connect via MCP. ChatGPT connects via OpenAPI actions. Any HTTP client can call the API directly.',
  },
  {
    question: 'Do I need an AI subscription?',
    answer:
      'Yes — bring your own assistant. The plugin adds the tools and the safety net (the validator); your assistant supplies the AI.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Premium features keep working on sites where Pro is already activated. Renewal covers updates and support.',
  },
  {
    question: 'How many sites?',
    answer: 'Unlimited — one Pro license activates on as many sites as you own or build for clients.',
  },
];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default function AiEditorPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/divi-5-ai-editor`;

  return (
    <main className="py-16">
      <Container>
        <JsonLd
          data={productJsonLd({
            name: PRODUCT_NAME,
            description: PRODUCT_DESCRIPTION,
            url,
            offer: { priceCents: 7900, currency: 'USD' },
          })}
        />
        <JsonLd data={faqJsonLd(FAQ)} />

        <h1 className="text-h1 text-navy">The AI Editor for Divi 5</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a
          deterministic validator before it touches your database — broken layouts are impossible.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />
          <a
            href="#free"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
          >
            Try it free
          </a>
        </div>

        <section className="mt-16">
          <h2 className="text-section text-navy">How it works</h2>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Card key={s.title} className="p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-section text-navy">What your AI can do</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="flex flex-col p-8">
              <h3 className="text-section text-navy">Free</h3>
              <ul className="mt-6 flex-1 space-y-3">
                {FREE_TOOLS.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </Card>
            <Card className="flex flex-col p-8">
              <h3 className="text-section text-navy">Pro</h3>
              <ul className="mt-6 flex-1 space-y-3">
                {PRO_TOOLS.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section id="free" className="mt-16">
          <h2 className="text-section text-navy">Free vs. Pro</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="flex flex-col p-8">
              <h3 className="text-section text-navy">Free</h3>
              <div className="mt-3 text-h2 text-navy">$0</div>
              <p className="mt-2 text-body text-muted">Edit and validate existing pages, all guides included.</p>
              <div className="mt-6">
                <FreeDownloadForm product="ai-editor-divi5-pro" />
              </div>
            </Card>

            <Card className="relative flex flex-col border-action p-8 shadow-lg ring-1 ring-action">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
                One license, unlimited sites
              </span>
              <h3 className="text-section text-navy">Pro</h3>
              <p className="mt-3 text-body text-muted">Billed annually. See pricing above.</p>
              <ul className="mt-6 flex-1 space-y-3">
                {PRO_TOOLS.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
                <Feature>WP-native updates</Feature>
                <Feature>Priority support</Feature>
                <Feature>Unlimited sites</Feature>
              </ul>
            </Card>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-section text-navy">Frequently asked questions</h2>
          <dl className="mt-6 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-small text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>
    </main>
  );
}
