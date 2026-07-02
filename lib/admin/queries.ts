import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, emailCaptures, packs, downloads } from '@/db/schema';
import type { LayoutRow } from '@/lib/catalog/queries';

export type LayoutStatus = 'pending' | 'approved' | 'published' | 'rejected';

export async function listEmailCaptures(): Promise<{ email: string; packTitle: string | null; createdAt: Date }[]> {
  const rows = await db
    .select({ email: emailCaptures.email, packTitle: packs.title, createdAt: emailCaptures.createdAt })
    .from(emailCaptures)
    .leftJoin(packs, eq(emailCaptures.packId, packs.id))
    .orderBy(desc(emailCaptures.createdAt));
  return rows.map((r) => ({ email: r.email, packTitle: r.packTitle ?? null, createdAt: r.createdAt }));
}

export async function listRecentDownloads(limit = 100): Promise<{ layoutTitle: string; email: string | null; ip: string | null; createdAt: Date }[]> {
  const rows = await db
    .select({ layoutTitle: layouts.title, email: downloads.email, ip: downloads.ip, createdAt: downloads.createdAt })
    .from(downloads)
    .innerJoin(layouts, eq(downloads.layoutId, layouts.id))
    .orderBy(desc(downloads.createdAt))
    .limit(limit);
  return rows.map((r) => ({ layoutTitle: r.layoutTitle, email: r.email ?? null, ip: r.ip ?? null, createdAt: r.createdAt }));
}

export async function listLayoutsByStatus(status: LayoutStatus): Promise<LayoutRow[]> {
  return db.select().from(layouts).where(eq(layouts.status, status)).orderBy(desc(layouts.createdAt));
}

export async function statusCounts(): Promise<Record<LayoutStatus, number>> {
  const rows = await db
    .select({ status: layouts.status, count: sql<number>`count(*)::int` })
    .from(layouts)
    .groupBy(layouts.status);
  const out: Record<LayoutStatus, number> = { pending: 0, approved: 0, published: 0, rejected: 0 };
  for (const r of rows) out[r.status as LayoutStatus] = r.count;
  return out;
}
