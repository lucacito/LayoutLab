import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/queue" className="text-gray-600 hover:underline">Queue</Link>
      </nav>
      {children}
    </div>
  );
}
