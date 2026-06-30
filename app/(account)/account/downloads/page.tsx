import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getDownloadableLayouts } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { DownloadButton } from '@/components/DownloadButton';

export const dynamic = 'force-dynamic';

export default async function DownloadsPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const layouts = userId ? await getDownloadableLayouts(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Your downloads</h1>
        <p className="mt-2 text-body text-muted">Everything you’re entitled to — re-download anytime.</p>
        {layouts.length === 0 ? (
          <div className="mt-8 rounded-card border border-border bg-mist p-10 text-center">
            <p className="text-body text-navy">Nothing here yet.</p>
            <p className="mt-1 text-small text-muted">Grab a free section or unlock a pack and it’ll show up here.</p>
            <Link href="/browse" className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
              Browse free sections
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {layouts.map((l) => (
              <li key={l.id}>
                <Card className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-body font-semibold text-navy">{l.title}</div>
                    <div className="text-small capitalize text-muted">{l.type} · {l.niche} · {l.style}</div>
                  </div>
                  <DownloadButton layoutId={l.id} slug={l.slug} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
