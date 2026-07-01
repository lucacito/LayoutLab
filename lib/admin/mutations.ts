import { eq, inArray } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import type { LayoutStatus } from './queries';

type LayoutUpdate = Partial<InferInsertModel<typeof layouts>>;

export async function setLayoutStatus(
  id: string,
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<{ slug: string } | null> {
  const set: LayoutUpdate = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  const rows = await db.update(layouts).set(set).where(eq(layouts.id, id)).returning({ slug: layouts.slug });
  return rows[0] ?? null;
}

export async function setLayoutsStatus(
  ids: string[],
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<{ slug: string }[]> {
  if (!ids.length) return [];
  const set: LayoutUpdate = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  return db.update(layouts).set(set).where(inArray(layouts.id, ids)).returning({ slug: layouts.slug });
}
