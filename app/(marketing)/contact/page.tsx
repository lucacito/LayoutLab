import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/components/marketing/ContactForm';
import { SUPPORT_EMAIL, SALES_EMAIL } from '@/lib/site/contact';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about Divi5Lab layouts, packs, membership, or a custom build? Get in touch.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main className="py-16">
      <Container className="max-w-2xl">
        <h1 className="text-h2 font-semibold text-navy">Get in touch</h1>
        <p className="mt-3 text-body text-muted">
          Questions about a layout, a pack, membership, or a custom build? Send us a message and we&apos;ll
          reply by email. For support you can also reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-action hover:underline">{SUPPORT_EMAIL}</a>,
          or for sales at{' '}
          <a href={`mailto:${SALES_EMAIL}`} className="text-action hover:underline">{SALES_EMAIL}</a>.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </Container>
    </main>
  );
}
