import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';

const WP_ORG_URL = 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/';

const PRODUCT_NAME = 'Elementor to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert Elementor pages and kits into real, validated Divi 5 layouts. Free plugin handles single-page JSON imports; Pro unlocks full kit ZIP import, global headers/footers, and priority support.';

export const metadata: Metadata = {
  // No "| Divi5Lab" suffix here — the root layout's `title.template` already
  // appends it (see app/layout.tsx), matching every other marketing page.
  title: 'Elementor to Divi 5 Converter — Free plugin + Pro',
  description:
    'Convert your Elementor pages and kits to Divi 5 in minutes. Free WordPress plugin for single-page imports; Pro adds full kit ZIP import, global headers/footers, and priority support — $49/yr, unlimited sites.',
};

const FREE_FEATURES = ['Unlimited single-page JSON imports', '140+ widget mappings', 'Conversion reports'];
const PRO_FEATURES = [
  'Full kit ZIP import',
  'Global headers/footers → Divi Theme Builder',
  'Global colors & typography',
  'Priority support',
  '1 year of updates',
  'Unlimited sites',
];

const STEPS = [
  { title: 'Export from Elementor', body: 'Export a page JSON (free) or a full kit ZIP (Pro) from your Elementor site.' },
  { title: 'Upload in Tools', body: 'Open the plugin in WordPress → Tools and upload the export.' },
  { title: 'Review & publish', body: 'The converter maps widgets to real Divi 5 modules — review the result and publish.' },
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
    answer: 'Yes — Pro is a license that extends the free plugin. Install the free plugin from WordPress.org first, then activate Pro.',
  },
];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/elementor-to-divi-5`;

  return (
    <main className="py-16">
      <Container>
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

        <h1 className="text-h1 text-navy">Convert Elementor to Divi 5</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          Move your pages — and whole kits — from Elementor into real, validated Divi 5 layouts. Free for
          single-page imports; Pro unlocks full kits, global styles, and priority support.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={WP_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
          >
            Get the free plugin
          </a>
          <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
        </div>

        <section className="mt-16">
          <h2 className="text-section text-navy">Free vs. Pro</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="flex flex-col p-8">
              <h3 className="text-section text-navy">Free</h3>
              <div className="mt-3 text-h2 text-navy">$0</div>
              <p className="mt-2 text-body text-muted">Single-page conversions, unlimited.</p>
              <ul className="mt-6 flex-1 space-y-3">
                {FREE_FEATURES.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </Card>

            <Card className="relative flex flex-col border-action p-8 shadow-lg ring-1 ring-action">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
                One license, unlimited sites
              </span>
              <h3 className="text-section text-navy">Pro</h3>
              <p className="mt-3 text-body text-muted">Billed annually. See pricing above.</p>
              <ul className="mt-6 flex-1 space-y-3">
                {PRO_FEATURES.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-section text-navy">How it works</h2>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </div>
            ))}
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
