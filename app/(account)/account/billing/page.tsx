import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getActiveSubscription } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { BillingButton } from '@/components/BillingButton';
import { AccountNav } from '@/components/account/AccountNav';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const sub = userId ? await getActiveSubscription(userId) : null;
  const active = sub?.status === 'active';

  return (
    <main className="py-12">
      <Container>
        <AccountNav />
        <h1 className="text-h2 text-navy">Billing</h1>
        <p className="mt-2 text-body text-muted">Your membership and payment details.</p>

        <Card className="mt-8 max-w-xl p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action/10 text-action">
              <Icon name={active ? 'workspace_premium' : 'credit_card'} size={22} />
            </span>
            <div>
              <p className="text-body font-semibold text-navy">{active ? 'All-access · active' : 'No active membership'}</p>
              <p className="text-small text-muted">
                {active
                  ? 'Update your payment method, download invoices, or cancel anytime in the secure portal.'
                  : 'Start an all-access membership to unlock the whole library.'}
              </p>
            </div>
          </div>
          <div className="mt-6">{active ? <BillingButton /> : (
            <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
              See plans
            </Link>
          )}</div>
        </Card>

        <p className="mt-4 max-w-xl text-small text-muted">Payments are handled securely by Stripe — we never see your card details.</p>
      </Container>
    </main>
  );
}
