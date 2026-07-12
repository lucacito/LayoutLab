import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getActiveSubscription, getStripeCustomerIdByEmail } from '@/lib/account/queries';
import { getLicensesForUser } from '@/lib/license-server/store';
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
  const [sub, licenses, stripeCustomerId] = userId
    ? await Promise.all([getActiveSubscription(userId), getLicensesForUser(userId), getStripeCustomerIdByEmail(email)])
    : [null, [], null];
  // "Active" covers both the legacy all-access subscription and any current
  // plugin Pro license — the Stripe portal handles renewals for either.
  const hasActiveLicense = licenses.some((l) => l.status === 'active' || l.status === 'past_due');
  const active = sub?.status === 'active' || hasActiveLicense;
  // The portal can only resolve users whose account is linked to a Stripe
  // customer (checkout does this; comped/manually-minted licenses don't) —
  // without it the portal route 400s, so don't render a dead button.
  const canOpenPortal = active && Boolean(stripeCustomerId);

  return (
    <main className="py-12">
      <Container>
        <AccountNav />
        <h1 className="text-h2 text-navy">Billing</h1>
        <p className="mt-2 text-body text-muted">Manage your plugin license billing.</p>

        <Card className="mt-8 max-w-xl p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action/10 text-action">
              <Icon name={active ? 'workspace_premium' : 'credit_card'} size={22} />
            </span>
            <div>
              <p className="text-body font-semibold text-navy">{active ? 'Legacy subscription · active' : 'No active subscription'}</p>
              <p className="text-small text-muted">
                {active
                  ? 'Update your payment method, download invoices, or cancel anytime in the secure portal — the same portal handles Pro plugin license renewals.'
                  : 'Plugin license renewals are managed in the secure Stripe portal. See Pro plugin pricing below.'}
              </p>
            </div>
          </div>
          <div className="mt-6">
            {canOpenPortal ? (
              <BillingButton />
            ) : active ? (
              <p className="text-small text-muted">
                Your license was issued manually — contact support@divi5lab.com for billing questions.
              </p>
            ) : (
              <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
                See plugin pricing
              </Link>
            )}
          </div>
        </Card>

        <p className="mt-4 max-w-xl text-small text-muted">Payments are handled securely by Stripe — we never see your card details.</p>
      </Container>
    </main>
  );
}
