import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { SectionShell } from '@/components/ui/SectionShell';
import { PageHero } from '@/components/marketing/PageHero';
import { ContactForm } from '@/components/marketing/ContactForm';
import { SUPPORT_EMAIL, SALES_EMAIL } from '@/lib/site/contact';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions about Divi5Lab plugins, layouts, or licensing? Get in touch.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Talk to us"
        title="Get in touch"
        lead={
          <>
            A human reads every message, usually within one business day. For support, include your site&apos;s
            WordPress and plugin versions and (for conversions) the export file that misbehaved; you&apos;ll skip a
            round-trip. Email works too:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-paper underline underline-offset-2">{SUPPORT_EMAIL}</a>{' '}
            for support,{' '}
            <a href={`mailto:${SALES_EMAIL}`} className="text-paper underline underline-offset-2">{SALES_EMAIL}</a>{' '}
            for sales and licensing.
          </>
        }
      />

      <SectionShell tone="paper" pad="lg">
        <Container className="max-w-2xl">
          <ContactForm />
        </Container>
      </SectionShell>
    </main>
  );
}
