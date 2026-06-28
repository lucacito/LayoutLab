import { listLayoutsByStatus } from '@/lib/admin/queries';
import { QueueTable, type QueueRow } from '@/components/admin/QueueTable';

export default async function AdminQueuePage() {
  const layouts = await listLayoutsByStatus('pending');
  const rows: QueueRow[] = layouts.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    type: l.type,
    niche: l.niche,
    style: l.style,
    preview: l.previewImageKeys[0] ?? null,
  }));
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Review queue ({rows.length} pending)</h1>
      <QueueTable rows={rows} />
    </main>
  );
}
