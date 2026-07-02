import { requireAdmin } from '@/lib/auth/admin';
import { listEmailCaptures, listRecentDownloads } from '@/lib/admin/queries';
import { CapturesTable, DownloadsTable } from '@/components/admin/EmailsTables';

export const dynamic = 'force-dynamic';

export default async function AdminEmailsPage() {
  await requireAdmin();
  const [captures, recentDownloads] = await Promise.all([listEmailCaptures(), listRecentDownloads(100)]);
  return (
    <main className="flex flex-col gap-10">
      <section>
        <h1 className="mb-4 text-2xl font-semibold text-navy">Captured emails</h1>
        <CapturesTable rows={captures} />
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold text-navy">Recent downloads</h2>
        <DownloadsTable rows={recentDownloads} />
      </section>
    </main>
  );
}
