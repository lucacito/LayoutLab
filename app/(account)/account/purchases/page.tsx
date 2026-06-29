import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getOrdersForUser, getEntitlementsForUser, getOwnedPacks, summarizeEntitlements } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;

  let orders: Awaited<ReturnType<typeof getOrdersForUser>> = [];
  let ents: Awaited<ReturnType<typeof getEntitlementsForUser>> = [];
  let ownedPacks: Awaited<ReturnType<typeof getOwnedPacks>> = [];
  if (userId) {
    [orders, ents, ownedPacks] = await Promise.all([getOrdersForUser(userId), getEntitlementsForUser(userId), getOwnedPacks(userId)]);
  }
  const { allAccess } = summarizeEntitlements(ents);

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Purchases</h1>

        <h2 className="mt-8 text-section text-navy">Your packs</h2>
        {allAccess && <p className="mt-2 text-small font-medium text-action">All-access membership active — every pack is yours.</p>}
        {ownedPacks.length === 0 ? (
          <p className="mt-2 text-body text-muted">
            No packs yet. <Link href="/pricing" className="font-medium text-action hover:underline">Browse packs</Link>.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ownedPacks.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate text-body font-semibold text-navy">{p.title}</div>
                    <div className="text-small capitalize text-muted">{p.kind} pack</div>
                  </div>
                  <a
                    href={`/api/download/pack/${p.id}`}
                    download={`${p.slug}.zip`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-action px-4 text-small font-semibold text-paper transition hover:brightness-110"
                  >
                    <Icon name="download" size={18} /> Download
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-section text-navy">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-body text-muted">No orders yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Card className="flex justify-between p-4">
                  <span className="text-body text-navy">${(o.amountCents / 100).toFixed(2)}</span>
                  <span className="text-small capitalize text-muted">{o.status}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
