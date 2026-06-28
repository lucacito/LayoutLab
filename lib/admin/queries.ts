import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import type { LayoutRow } from '@/lib/catalog/queries';

export type LayoutStatus = 'pending' | 'approved' | 'published' | 'rejected';

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
