import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail } from '@/lib/account/queries';
import { getLicensesForUser } from '@/lib/license-server/store';
import { Container } from '@/components/ui/Container';
import { AccountNav } from '@/components/account/AccountNav';
import { PRODUCT_TITLES, type PluginProduct } from '@/lib/license-server/core';
import { LicenseTierCard } from '@/components/account/LicenseTierCard';

export const dynamic = 'force-dynamic';

export default async function LicensesPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const licenses = userId ? await getLicensesForUser(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <AccountNav />
        <h1 className="text-h2 text-navy">Your plugin licenses</h1>
        <p className="mt-2 text-body text-muted">License keys, activated sites, and Pro plugin downloads.</p>
        {licenses.length === 0 ? (
          <div className="mt-8 rounded-card border border-border bg-mist p-10 text-center">
            <p className="text-body text-navy">No licenses yet.</p>
            <p className="mt-1 text-small text-muted">Buy a Pro plugin and your license key will show up here.</p>
            <Link href="/pricing" className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
              See plugin pricing
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {licenses.map((l) => (
              <li key={l.id}>
                <LicenseTierCard license={l} productTitle={PRODUCT_TITLES[l.productSlug as PluginProduct] ?? l.productSlug} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
