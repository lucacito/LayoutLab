import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { statusCounts } from '@/lib/admin/queries';

export default async function AdminDashboard() {
  const counts = await statusCounts();
  const cards: { label: string; key: keyof typeof counts; href?: string }[] = [
    { label: 'Pending', key: 'pending', href: '/admin/queue' },
    { label: 'Published', key: 'published' },
    { label: 'Approved (de-listed)', key: 'approved' },
    { label: 'Rejected', key: 'rejected' },
  ];
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold text-navy">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <Card className="p-5">
              <div className="text-h3 font-bold text-navy">{counts[c.key]}</div>
              <div className="mt-1 text-small text-muted">{c.label}</div>
            </Card>
          );
          return c.href ? <Link key={c.key} href={c.href}>{body}</Link> : <div key={c.key}>{body}</div>;
        })}
      </div>
    </main>
  );
}
