import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getOrdersForUser, getEntitlementsForUser } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const orders = userId ? await getOrdersForUser(userId) : [];
  const ents = userId ? await getEntitlementsForUser(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Purchases</h1>
        <h2 className="mt-8 text-section text-navy">Orders</h2>
        {orders.length === 0 ? <p className="mt-2 text-body text-muted">No orders yet.</p> : (
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id}><Card className="flex justify-between p-4">
                <span className="text-body text-navy">${(o.amountCents / 100).toFixed(2)}</span>
                <span className="text-small capitalize text-muted">{o.status}</span>
              </Card></li>
            ))}
          </ul>
        )}
        <h2 className="mt-8 text-section text-navy">Access</h2>
        <ul className="mt-3 space-y-2">
          {ents.map((e, i) => (
            <li key={i} className="text-body text-muted capitalize">{e.scope.replace(':', ': ')} <span className="text-small">({e.source})</span></li>
          ))}
          {ents.length === 0 && <li className="text-body text-muted">No access grants yet.</li>}
        </ul>
      </Container>
    </main>
  );
}
