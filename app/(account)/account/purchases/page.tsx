import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getOrdersForUser, getEntitlementsForUser, getOwnedPacks, summarizeEntitlements } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { AccountNav } from '@/components/account/AccountNav';

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
        <AccountNav />
        <h1 className="text-h2 text-navy">Legacy purchases</h1>
        <p className="mt-2 text-body text-muted">
          Packs you&apos;ve claimed, plus order history from before the catalog went fully free. Looking for plugin
          licenses? Head to <Link href="/account/licenses" className="font-semibold text-action hover:underline">Licenses</Link>.
        </p>

        <h2 className="mt-8 text-section text-navy">Your packs</h2>
        {allAccess && (
          <p className="mt-2 flex items-center gap-1.5 text-small font-medium text-action">
            <Icon name="auto_awesome" size={16} /> All-access membership active — every pack is yours.
          </p>
        )}
        {ownedPacks.length === 0 ? (
          <Card className="mt-3 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-semibold text-navy">No packs yet</p>
              <p className="text-small text-muted">Every layout in the catalog is free — grab one from Browse, or check out the migration plugins.</p>
            </div>
            <Link href="/plugins" className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
              Browse plugins
            </Link>
          </Card>
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
          <p className="mt-2 text-body text-muted">No orders yet — your receipts will appear here after a purchase.</p>
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
