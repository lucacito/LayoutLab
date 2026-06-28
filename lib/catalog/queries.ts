import { and, eq, asc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, packs, packLayouts } from '@/db/schema';
import { buildLayoutFilters, type CatalogFilters } from './filters';

export type LayoutRow = typeof layouts.$inferSelect;
export type PackRow = typeof packs.$inferSelect;

export async function listLayouts(f: CatalogFilters): Promise<LayoutRow[]> {
  const { where, orderBy, limit, offset } = buildLayoutFilters(f);
  return db.select().from(layouts).where(where).orderBy(orderBy).limit(limit).offset(offset);
}

export async function getLayoutBySlug(slug: string): Promise<LayoutRow | null> {
  const rows = await db.select().from(layouts)
    .where(and(eq(layouts.slug, slug), eq(layouts.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function listPacks(): Promise<PackRow[]> {
  return db.select().from(packs).where(eq(packs.status, 'published')).orderBy(asc(packs.title));
}

export async function getPackBySlug(slug: string): Promise<PackRow | null> {
  const rows = await db.select().from(packs)
    .where(and(eq(packs.slug, slug), eq(packs.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function getLayoutsForPack(packId: string): Promise<LayoutRow[]> {
  const rows = await db.select({ layout: layouts }).from(packLayouts)
    .innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
    .where(and(eq(packLayouts.packId, packId), eq(layouts.status, 'published')))
    .orderBy(asc(packLayouts.position));
  return rows.map((r) => r.layout);
}

export async function getPacksForLayout(layoutId: string): Promise<PackRow[]> {
  const rows = await db.select({ pack: packs }).from(packLayouts)
    .innerJoin(packs, eq(packLayouts.packId, packs.id))
    .where(and(eq(packLayouts.layoutId, layoutId), eq(packs.status, 'published')))
    .orderBy(asc(packs.title));
  return rows.map((r) => r.pack);
}

export async function facetCounts(): Promise<Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>> {
  const rows = await db.select({
    type: layouts.type, niche: layouts.niche, style: layouts.style, colors: layouts.colors,
  }).from(layouts).where(eq(layouts.status, 'published'));

  const counts = { type: {}, niche: {}, style: {}, color: {} } as Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>;
  const bump = (axis: 'type' | 'niche' | 'style' | 'color', key: string | null) => {
    if (!key) return;
    counts[axis][key] = (counts[axis][key] ?? 0) + 1;
  };
  for (const r of rows) {
    bump('type', r.type);
    bump('niche', r.niche);
    bump('style', r.style);
    for (const c of r.colors ?? []) bump('color', c);
  }
  return counts;
}

export async function listAllPublishedLayoutSlugs(): Promise<{ slug: string; publishedAt: Date | null }[]> {
  return db.select({ slug: layouts.slug, publishedAt: layouts.publishedAt })
    .from(layouts).where(eq(layouts.status, 'published'));
}

export async function listAllPublishedPackSlugs(): Promise<{ slug: string; createdAt: Date }[]> {
  return db.select({ slug: packs.slug, createdAt: packs.createdAt })
    .from(packs).where(eq(packs.status, 'published'));
}
