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
        <h1 className="text-h2 text-navy">Downloads</h1>
        {layouts.length === 0 ? (
          <p className="mt-4 text-body text-muted">No downloads yet. Browse the catalog to get started.</p>
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
