'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { setLayoutStatus, setLayoutsStatus } from '@/lib/admin/mutations';
import { submitToIndexNow } from '@/lib/seo/indexnow';
import { env } from '@/lib/env';

function revalidateCatalog(slug?: string | null) {
  revalidatePath('/browse');
  revalidatePath('/');
  if (slug) revalidatePath(`/layouts/${slug}`);
}

// Push freshly-published layout URLs to IndexNow so search engines discover
// them in seconds. Best-effort: submitToIndexNow never throws.
async function pingIndexNow(slugs: Array<string | null | undefined>) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const urls = slugs.filter((s): s is string => Boolean(s)).map((s) => `${base}/layouts/${s}`);
  if (urls.length) await submitToIndexNow(env.NEXT_PUBLIC_SITE_URL, urls);
}

export async function approveLayout(id: string): Promise<void> {
  await requireAdmin();
  const row = await setLayoutStatus(id, 'published', { publishedAt: new Date() });
  revalidateCatalog(row?.slug);
  await pingIndexNow([row?.slug]);
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
  const rows = await setLayoutsStatus(ids, 'published', { publishedAt: new Date() });
  revalidateCatalog();
  await pingIndexNow(rows.map((r) => r.slug));
}
