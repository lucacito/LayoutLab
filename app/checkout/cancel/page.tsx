// app/checkout/cancel/page.tsx
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

export default function CheckoutCancel() {
  return (
    <main className="py-24">
      <Container className="mx-auto max-w-xl text-center">
        <h1 className="text-h2 text-navy">Checkout canceled</h1>
        <p className="mt-4 text-lead text-muted">No charge was made. You can pick up where you left off anytime.</p>
        <div className="mt-8 flex justify-center"><Button href="/pricing">Back to pricing</Button></div>
      </Container>
    </main>
  );
}
