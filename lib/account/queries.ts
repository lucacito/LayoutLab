import { randomUUID } from 'node:crypto';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, layouts, packs, packLayouts, entitlements, orders, subscriptions, downloads } from '@/db/schema';
import type { LayoutRow } from '@/lib/catalog/queries';
import { type UserEntitlement, isActiveAllAccess } from '@/lib/stripe/entitlements';

export function summarizeEntitlements(
  entitlementsList: UserEntitlement[],
  now: Date = new Date(),
): { allAccess: boolean; ownedPackIds: string[] } {
  const allAccess = entitlementsList.some((e) => isActiveAllAccess(e, now));
  const ownedPackIds = entitlementsList
    .filter((e) => e.scope.startsWith('pack:'))
    .map((e) => e.scope.slice('pack:'.length));
  return { allAccess, ownedPackIds };
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.id ?? null;
}

export async function getEntitlementsForUser(userId: string): Promise<UserEntitlement[]> {
  return db.select({ scope: entitlements.scope, source: entitlements.source, expiresAt: entitlements.expiresAt })
    .from(entitlements).where(eq(entitlements.userId, userId));
}

export async function getLayoutForDownload(layoutId: string): Promise<{ id: string; slug: string; diviJsonBlobKey: string } | null> {
  const rows = await db.select({ id: layouts.id, slug: layouts.slug, diviJsonBlobKey: layouts.diviJsonBlobKey })
    .from(layouts).where(and(eq(layouts.id, layoutId), eq(layouts.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function getLayoutPackContext(layoutId: string): Promise<{ packIds: string[]; packKindById: Record<string, 'free' | 'paid'> }> {
  const rows = await db.select({ packId: packs.id, kind: packs.kind })
    .from(packLayouts).innerJoin(packs, eq(packLayouts.packId, packs.id))
    .where(eq(packLayouts.layoutId, layoutId));
  const packIds = rows.map((r) => r.packId);
  const packKindById: Record<string, 'free' | 'paid'> = {};
  for (const r of rows) packKindById[r.packId] = r.kind;
  return { packIds, packKindById };
}

export async function getOrdersForUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getActiveSubscription(userId: string) {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.currentPeriodEnd)).limit(1);
  return rows[0] ?? null;
}

export async function getDownloadableLayouts(userId: string): Promise<LayoutRow[]> {
  const ents = await getEntitlementsForUser(userId);
  const { allAccess, ownedPackIds } = summarizeEntitlements(ents);
  if (allAccess) {
    return db.select().from(layouts).where(eq(layouts.status, 'published')).orderBy(desc(layouts.createdAt));
  }
  if (ownedPackIds.length === 0) return [];
  const rows = await db.selectDistinct({ layout: layouts }).from(packLayouts)
    .innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
    .where(and(inArray(packLayouts.packId, ownedPackIds), eq(layouts.status, 'published')));
  return rows.map((r) => r.layout);
}

export async function recordDownload(userId: string | null, layoutId: string, ip: string | null): Promise<void> {
  await db.insert(downloads).values({ id: randomUUID(), userId: userId ?? undefined, layoutId, ip: ip ?? undefined });
}
