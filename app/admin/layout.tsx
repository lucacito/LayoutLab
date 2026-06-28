import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <Container>
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/admin" className="font-semibold text-navy hover:text-action">Admin</Link>
        <Link href="/admin/queue" className="text-muted hover:text-action">Queue</Link>
      </nav>
      <div className="bg-mist rounded-card p-6 mb-6">
        {children}
      </div>
    </Container>
  );
}
