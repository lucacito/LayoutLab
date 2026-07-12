// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';

export const metadata: Metadata = {
  title: 'Pricing — Pro plugin licenses',
  description:
    'Simple pricing for the Divi 5 plugin toolkit. Free plugins on wordpress.org; Pro unlocks the full migration toolkit for $49/yr on unlimited sites.',
};

const FAQ = [
  {
    question: 'What does Pro include?',
    answer:
      'Full kit ZIP import, global headers/footers mapped to the Divi Theme Builder, global colors & typography, a year of updates, and priority support.',
  },
  {
    question: 'Do licenses cover client sites?',
    answer: 'Yes — a Pro license activates on unlimited sites, whether they are yours or built for clients.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on every site where it is already activated. You just stop receiving new updates and support until you renew.',
  },
  {
    question: 'Are the layouts really free?',
    answer: 'Yes — every layout in our catalog is free to download. Drop your email and grab as many as you like.',
  },
];

const E2D5_FEATURES = [
  'Full kit ZIP import',
  'Global headers/footers → Divi Theme Builder',
  'Global colors & typography',
  '1 year of updates + priority support',
  'Unlimited sites',
];

const D2E_FEATURES = ['Divi Theme Builder templates', 'WooCommerce module/widget mapping', 'Batch conversion tooling', 'Unlimited sites'];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default async function PricingPage() {
  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Simple pricing">
          Free plugins on wordpress.org. Pro unlocks the full migration toolkit — $49/yr, unlimited sites.
        </SectionTitle>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-2">
          <Card className="relative flex flex-col border-action p-8 shadow-lg ring-1 ring-action">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
              Available now
            </span>
            <h2 className="text-section text-navy">Elementor → Divi 5 Pro</h2>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-h2 text-navy">$49</span>
              <span className="text-small text-muted">/yr</span>
            </div>
            <p className="mt-2 text-body text-muted">The full migration toolkit for moving Elementor sites to Divi 5.</p>
            <ul className="mt-6 flex-1 space-y-3">
              {E2D5_FEATURES.map((f) => (
                <Feature key={f}>{f}</Feature>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-2">
              <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
              <Link href="/plugins/elementor-to-divi-5" className="text-center text-small font-semibold text-action hover:underline">
                Learn more
              </Link>
            </div>
          </Card>

          <Card className="flex flex-col p-8">
            <h2 className="text-section text-navy">Divi → Elementor Pro</h2>
            <div className="mt-3 text-h3 text-navy">Coming soon</div>
            <p className="mt-2 text-body text-muted">Free plugin pending wordpress.org review — Pro launches once it&apos;s live.</p>
            <ul className="mt-6 flex-1 space-y-3">
              {D2E_FEATURES.map((f) => (
                <Feature key={f}>{f}</Feature>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/plugins/divi-to-elementor"
                className="flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
              >
                Get notified
              </Link>
            </div>
          </Card>
        </div>

        <section className="mt-16">
          <Card className="flex flex-col gap-3 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-section text-navy">Divi 5 AI Editor</h2>
              <p className="mt-2 max-w-xl text-body text-muted">
                Edit and generate Divi 5 pages with AI, validated before it ever touches your site. Coming soon.
              </p>
            </div>
            <Link
              href="/plugins/divi-5-ai-editor"
              className="flex h-12 shrink-0 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Learn more
            </Link>
          </Card>
        </section>

        <section className="mt-8">
          <Card className="flex flex-col gap-3 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-section text-navy">Free Divi 5 layouts</h2>
              <p className="mt-2 max-w-xl text-body text-muted">Every layout in our catalog is free — grab as many as you like.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/free-divi-layouts"
                className="flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
              >
                Get free layouts
              </Link>
              <Link
                href="/browse"
                className="flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
              >
                Browse the catalog
              </Link>
            </div>
          </Card>
        </section>

        <section className="mt-20">
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

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}
