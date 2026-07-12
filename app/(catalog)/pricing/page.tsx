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
import { STATS } from '@/lib/site/stats';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'Pricing — Pro plugin licenses',
  description:
    'Simple pricing for the Divi 5 plugin toolkit. Free plugins and free layouts to start; Pro licenses from $49/yr on unlimited sites — and nothing breaks if you stop paying.',
};

const FAQ = [
  {
    question: 'What does Pro include?',
    answer:
      'Each plugin has its own Pro: the Elementor→Divi 5 converter adds full kit ZIP import, Theme Builder headers/footers, and global styles; the AI Editor adds page creation, menus, and site-wide styling. Both include a year of updates and priority support.',
  },
  {
    question: 'Do licenses cover client sites?',
    answer: 'Yes — every Pro license activates on unlimited sites, whether they are yours or built for clients.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on every site where it is already activated. You just stop receiving new updates and support until you renew. No hostage access.',
  },
  {
    question: 'Are the layouts really free?',
    answer: 'Yes — every layout in our catalog is free to download. Drop your email and grab as many as you like.',
  },
  {
    question: 'Can I try before buying?',
    answer: 'Always. Every product has a working free tier — free single-page conversions, a free AI Editor download, and a fully free layout catalog.',
  },
  {
    question: 'Is there a refund policy?',
    answer:
      "Digital goods are final-sale, but we make things right: if a Pro plugin is genuinely broken for your project and support cannot fix it within 14 days of purchase, we'll sort it out. Subscriptions cancel anytime. Full policy on the license page.",
  },
  {
    question: 'How is payment handled?',
    answer: 'Checkout runs on Stripe with tax handled automatically. Licenses are delivered instantly by email and manageable from your account.',
  },
  {
    question: 'When is Pro coming for Divi → Elementor?',
    answer: 'After the free plugin clears wordpress.org review. Join the waitlist on its page — members hear first and get launch pricing.',
  },
];

const TOOLKIT = [
  {
    name: 'Elementor → Divi 5 Pro',
    price: '$49',
    per: '/yr',
    tagline: 'The full migration toolkit for moving Elementor sites to Divi 5.',
    freeTier: `Free plugin: unlimited single-page conversions, ${STATS.elementorWidgetsMapped} widget mappings, conversion reports.`,
    proTier: 'Pro: full kit ZIP import, Theme Builder headers/footers, global colors & typography.',
    action: <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />,
    href: '/plugins/elementor-to-divi-5',
    highlight: true,
  },
  {
    name: 'AI Editor for Divi 5 Pro',
    price: '$79',
    per: '/yr',
    tagline: 'Let your AI assistant build pages, menus and site-wide styling — every change validated.',
    freeTier: 'Free download: edit and validate existing pages, all guides and recipes included.',
    proTier: 'Pro: create pages from scratch, front page, menus, site-wide CSS, reviewed PHP.',
    action: <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />,
    href: '/plugins/divi-5-ai-editor',
    highlight: false,
  },
  {
    name: 'Divi → Elementor Pro',
    price: 'Coming soon',
    per: '',
    tagline: `Batch conversions the other way — ${STATS.diviModulesMapped}+ modules mapped.`,
    freeTier: 'Free plugin pending wordpress.org review — batch conversion, all Divi export formats.',
    proTier: 'Pro (after launch): Theme Builder templates, WooCommerce mapping — $49/yr.',
    action: (
      <Link
        href="/plugins/divi-to-elementor"
        className="flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
      >
        Get notified
      </Link>
    ),
    href: '/plugins/divi-to-elementor',
    highlight: false,
  },
];

export default async function PricingPage() {
  return (
    <main>
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <SectionTitle eyebrow="Pricing" title="Licenses that respect you">
            Free tiers on everything. Pro from $49/yr on unlimited sites — and when a license lapses,
            nothing breaks: activated sites keep working. Renewal buys updates and support, not hostage access.
          </SectionTitle>
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {TOOLKIT.map((p) => (
              <Card
                key={p.name}
                className={`relative flex flex-col p-8 ${p.highlight ? 'border-action shadow-lg ring-1 ring-action' : ''}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
                    Most popular
                  </span>
                )}
                <h2 className="text-section text-navy">{p.name}</h2>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={p.per ? 'text-h2 text-navy' : 'text-h3 text-navy'}>{p.price}</span>
                  {p.per && <span className="text-small text-muted">{p.per}</span>}
                </div>
                <p className="mt-2 text-body text-muted">{p.tagline}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {p.freeTier}
                  </li>
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="workspace_premium" size={18} className="mt-0.5 shrink-0 text-action" /> {p.proTier}
                  </li>
                </ul>
                <div className="mt-8 flex flex-col gap-2">
                  {p.action}
                  <Link href={p.href} className="text-center text-small font-semibold text-action hover:underline">
                    Full details
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 flex flex-col gap-3 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-section text-navy">Free Divi 5 layouts</h2>
              <p className="mt-2 max-w-xl text-body text-muted">
                Every layout in our catalog — {STATS.freeLayoutsPublished}+ validated sections and pages — is free.
                Grab as many as you like.
              </p>
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
        </Container>
      </section>

      <section className="border-t border-border bg-mist py-20">
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
      </section>

      <CtaBand
        title="Try everything free first."
        body="Free conversions, a free AI Editor, a free layout catalog — upgrade when the tools have already earned it."
        cta={{ label: 'Browse the plugins', href: '/plugins' }}
      />

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}
