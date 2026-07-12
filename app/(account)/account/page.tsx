import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getOwnedPacks, getDownloadableLayouts } from '@/lib/account/queries';
import { getLicensesForUser } from '@/lib/license-server/store';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LayoutCard } from '@/components/LayoutCard';
import { SavedCount } from '@/components/bookmarks/SavedCount';
import { AccountNav } from '@/components/account/AccountNav';

export const dynamic = 'force-dynamic';

function firstName(email: string): string {
  const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? '';
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
}

export default async function AccountPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;

  const [packs, downloads, licenses] = userId
    ? await Promise.all([getOwnedPacks(userId), getDownloadableLayouts(userId), getLicensesForUser(userId)])
    : [[], [], []];
  const activeLicenseCount = licenses.filter((l) => l.status === 'active' || l.status === 'past_due').length;

  const stats = [
    { icon: 'download', label: 'Downloads', value: downloads.length as React.ReactNode, href: '/account/downloads', hint: 'Re-download anytime' },
    { icon: 'inventory_2', label: 'Your packs', value: packs.length as React.ReactNode, href: '/account/purchases', hint: 'Owned collections' },
    { icon: 'bookmark', label: 'Saved', value: <SavedCount />, href: '/saved', hint: 'On this device' },
  ];

  return (
    <main className="py-12">
      <Container>
        <AccountNav />
        {/* Greeting */}
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-action/10 text-h3 font-bold text-action">
            {firstName(email).charAt(0)}
          </span>
          <div>
            <h1 className="text-h2 text-navy">Welcome back, {firstName(email)} 👋</h1>
            <p className="text-body text-muted">{email}</p>
          </div>
        </div>

        {/* Licenses */}
        {activeLicenseCount > 0 ? (
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card border border-action bg-action/5 p-6 shadow-soft ring-1 ring-action sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Icon name="workspace_premium" size={24} className="text-action" />
              <div>
                <p className="text-body font-semibold text-navy">
                  {activeLicenseCount} active plugin license{activeLicenseCount === 1 ? '' : 's'}
                </p>
                <p className="text-small text-muted">Manage your Pro plugin license keys, activated sites, and downloads.</p>
              </div>
            </div>
            <Link href="/account/licenses" className="shrink-0 text-small font-semibold text-action hover:underline">View licenses →</Link>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card bg-navy p-6 text-paper shadow-soft sm:flex-row sm:items-center">
            <div>
              <p className="text-body font-semibold text-paper">No plugin licenses yet</p>
              <p className="text-small text-paper/80">Pro unlocks the full WordPress migration toolkit — license keys, activated sites, and downloads all live in one place.</p>
            </div>
            <Button href="/account/licenses" variant="secondary" className="shrink-0">View licenses</Button>
          </div>
        )}

        {/* Your stuff */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="flex h-full items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mist text-action">
                  <Icon name={s.icon} size={22} />
                </span>
                <div>
                  <div className="text-h3 text-navy">{s.value}</div>
                  <div className="text-small font-medium text-navy">{s.label}</div>
                  <div className="text-small text-muted">{s.hint}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Ready to download, or a friendly empty state */}
        {downloads.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-end justify-between">
              <h2 className="text-section text-navy">Ready to download</h2>
              <Link href="/account/downloads" className="text-small font-semibold text-action hover:underline">View all →</Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {downloads.slice(0, 6).map((l) => <LayoutCard key={l.id} layout={l} />)}
            </div>
          </section>
        ) : (
          <Card className="mt-12 p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action">
              <Icon name="waving_hand" size={26} />
            </span>
            <h2 className="mt-4 text-h3 text-navy">Let’s get you started</h2>
            <p className="mx-auto mt-2 max-w-md text-body text-muted">
              You haven’t grabbed anything yet. Every individual section is free — pick one and import it into Divi 5 in seconds.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button href="/browse">Browse free sections</Button>
              <Link href="/plugins" className="flex h-10 items-center justify-center rounded-full border border-border bg-paper px-5 text-small font-semibold text-navy transition hover:border-action hover:text-action">
                Browse plugins
              </Link>
            </div>
          </Card>
        )}
      </Container>
    </main>
  );
}
