'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { setLayoutStatus, setLayoutsStatus } from '@/lib/admin/mutations';

function revalidateCatalog(slug?: string | null) {
  revalidatePath('/browse');
  revalidatePath('/');
  if (slug) revalidatePath(`/layouts/${slug}`);
}

export async function approveLayout(id: string): Promise<void> {
  await requireAdmin();
  const row = await setLayoutStatus(id, 'published', { publishedAt: new Date() });
  revalidateCatalog(row?.slug);
}

export async function rejectLayout(id: string): Promise<void> {
  await requireAdmin();
  await setLayoutStatus(id, 'rejected');
  revalidatePath('/admin/queue');
}

export async function unpublishLayout(id: string): Promise<void> {
  await requireAdmin();
  const row = await setLayoutStatus(id, 'approved');
  revalidateCatalog(row?.slug);
}

export async function bulkApprove(ids: string[]): Promise<void> {
  await requireAdmin();
  await setLayoutsStatus(ids, 'published', { publishedAt: new Date() });
  revalidateCatalog();
}
