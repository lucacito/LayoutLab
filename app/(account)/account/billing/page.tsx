import { requireUser } from '@/lib/auth/admin';
import { Container } from '@/components/ui/Container';
import { BillingButton } from '@/components/BillingButton';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  await requireUser();
  return (
    <main className="py-12">
      <Container className="max-w-xl">
        <h1 className="text-h2 text-navy">Billing</h1>
        <p className="mt-4 text-body text-muted">Manage your membership, payment method, and invoices in the Stripe customer portal.</p>
        <div className="mt-6"><BillingButton /></div>
      </Container>
    </main>
  );
}
