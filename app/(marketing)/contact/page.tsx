import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/marketing/ContactForm';
import { SUPPORT_EMAIL, SALES_EMAIL } from '@/lib/site/contact';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about Divi5Lab plugins, layouts, or licensing? Get in touch.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main className="py-16">
      <Container className="max-w-2xl">
        <h1 className="text-h2 font-semibold text-navy">Get in touch</h1>
        <p className="mt-3 text-body text-muted">
          A human reads every message — usually within one business day. For support, include your site&apos;s
          WordPress and plugin versions and (for conversions) the export file that misbehaved; you&apos;ll skip a
          round-trip. Email works too:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-action hover:underline">{SUPPORT_EMAIL}</a> for support,{' '}
          <a href={`mailto:${SALES_EMAIL}`} className="text-action hover:underline">{SALES_EMAIL}</a> for sales and licensing.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </Container>
    </main>
  );
}
