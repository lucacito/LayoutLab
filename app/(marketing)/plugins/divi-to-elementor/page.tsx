import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';

export const metadata: Metadata = {
  title: 'Divi to Elementor Converter — free WordPress plugin (pending review)',
  description:
    'Convert Divi pages and templates to Elementor. The free plugin is submitted and pending wordpress.org review — join the waitlist to be notified the moment it ships.',
};

const FEATURES = [
  '35+ Divi modules mapped to Elementor widgets',
  'Batch conversion — convert many pages in one run',
  'Supports all three Divi export formats',
  'Conversion reports for every run',
];

const PRO_FEATURES = ['Divi Theme Builder templates', 'WooCommerce module/widget mapping', 'Batch conversion tooling', 'Unlimited sites'];

const FAQ = [
  {
    question: 'When will the free plugin be available?',
    answer: "It's submitted to wordpress.org and awaiting review. We'll email the waitlist the moment it's approved and live.",
  },
  {
    question: 'Will there be a Pro version?',
    answer: 'Yes — Pro launches after the free plugin is approved, at $49/yr for unlimited sites, with Theme Builder templates and WooCommerce support.',
  },
];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default function D2EPage() {
  return (
    <main className="py-16">
      <Container>
        <JsonLd data={faqJsonLd(FAQ)} />

        <h1 className="text-h1 text-navy">Convert Divi to Elementor</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          Move your Divi pages and templates into Elementor — 35+ modules mapped, batch conversion, and support for
          every Divi export format.
        </p>

        <Card className="mt-8 max-w-2xl border-amber-200 bg-amber-50 p-8">
          <p className="text-body text-navy">
            The free plugin is submitted and <strong>pending wordpress.org review</strong> — leave your email and
            we&apos;ll tell you the moment it&apos;s approved.
          </p>
          <div className="mt-4">
            <WaitlistForm source="divi_to_elementor_waitlist" cta="Notify me" />
          </div>
        </Card>

        <section className="mt-16">
          <h2 className="text-section text-navy">What it does</h2>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-section text-navy">Pro coming after approval</h2>
          <p className="mt-2 text-body text-muted">
            Once the free plugin is live, Pro follows for <span className="font-semibold text-navy">$49/yr</span>,
            unlimited sites.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRO_FEATURES.map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
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
