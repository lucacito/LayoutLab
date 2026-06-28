import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import type { LayoutStatus } from './queries';

export async function setLayoutStatus(
  id: string,
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<{ slug: string } | null> {
  const set: Record<string, unknown> = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  const rows = await db.update(layouts).set(set).where(eq(layouts.id, id)).returning({ slug: layouts.slug });
  return rows[0] ?? null;
}

export async function setLayoutsStatus(
  ids: string[],
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<void> {
  if (!ids.length) return;
  const set: Record<string, unknown> = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  await db.update(layouts).set(set).where(inArray(layouts.id, ids));
}
