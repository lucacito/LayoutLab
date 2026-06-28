import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getActiveSubscription } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const sub = userId ? await getActiveSubscription(userId) : null;

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Your account</h1>
        <p className="mt-2 text-body text-muted">{email}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: '/account/downloads', label: 'Downloads' },
            { href: '/account/purchases', label: 'Purchases' },
            { href: '/account/billing', label: 'Billing' },
          ].map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="p-6"><div className="text-section text-navy">{c.label}</div></Card>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-small text-muted">
          Membership: {sub && sub.status === 'active' ? 'Active (all-access)' : 'None'}
        </p>
      </Container>
    </main>
  );
}
