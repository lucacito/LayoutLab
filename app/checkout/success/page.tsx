// app/checkout/success/page.tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

// Post-purchase confirmation — noindex (thin, per-user, not a content section).
export const metadata: Metadata = { title: 'Payment received', robots: { index: false, follow: true } };

export default function CheckoutSuccess() {
  return (
    <main className="py-24">
      <Container className="mx-auto max-w-xl text-center">
        <h1 className="text-h2 text-navy">Payment received 🎉</h1>
        <p className="mt-4 text-lead text-muted">
          We&apos;re provisioning your access now. Sign in with the email you used at checkout to download your layouts.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button href="/browse">Browse layouts</Button>
          <Button href="/login" variant="secondary">Sign in</Button>
        </div>
      </Container>
    </main>
  );
}
