import { and, eq, ne, asc, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, packs, packLayouts } from '@/db/schema';
import { buildLayoutFilters } from './query-builder';
import { type CatalogFilters } from './filters';

export type LayoutRow = typeof layouts.$inferSelect;
export type PackRow = typeof packs.$inferSelect;

export async function listLayouts(f: CatalogFilters): Promise<LayoutRow[]> {
  const { where, orderBy, limit, offset } = buildLayoutFilters(f);
  return db.select().from(layouts).where(where).orderBy(orderBy).limit(limit).offset(offset);
}

/** Total published layouts matching the same filters (for pagination). */
export async function countLayouts(f: CatalogFilters): Promise<number> {
  const { where } = buildLayoutFilters(f);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(layouts).where(where);
  return row?.n ?? 0;
}

/** All published layouts, newest first — used to build the homepage category sections. */
export async function listPublishedLayouts(): Promise<LayoutRow[]> {
  return db.select().from(layouts)
    .where(eq(layouts.status, 'published'))
    .orderBy(desc(layouts.publishedAt), desc(layouts.createdAt));
}

/** Sibling elements of the same type (variant navigation) — same type, others first by niche match. */
export async function listRelatedLayouts(type: string, excludeId: string, limit = 6): Promise<LayoutRow[]> {
  return db
    .select()
    .from(layouts)
    .where(and(eq(layouts.status, 'published'), eq(layouts.type, type), ne(layouts.id, excludeId)))
    .orderBy(desc(layouts.publishedAt))
    .limit(limit);
}

/** Published siblings in a variant group (same family, different columns/icons). */
export async function listVariantSiblings(group: string): Promise<LayoutRow[]> {
  return db
    .select()
    .from(layouts)
    .where(and(eq(layouts.status, 'published'), sql`${layouts.variant}->>'group' = ${group}`));
}

/**
 * Layouts downloadable for free — the complement of isPaidOnlyLayout
 * (lib/stripe/entitlements): a layout is free unless EVERY published pack it
 * belongs to is paid. So: no paid pack, or at least one free pack.
 */
export async function listFreeLayouts(limit = 48): Promise<LayoutRow[]> {
  const paidExists = sql`EXISTS (
    SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
    WHERE pl.layout_id = ${layouts.id} AND p.status = 'published' AND p.kind = 'paid')`;
  const freeExists = sql`EXISTS (
    SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
    WHERE pl.layout_id = ${layouts.id} AND p.status = 'published' AND p.kind = 'free')`;
  return db
    .select()
    .from(layouts)
    .where(and(eq(layouts.status, 'published'), sql`(NOT ${paidExists} OR ${freeExists})`))
    .orderBy(desc(layouts.publishedAt), desc(layouts.createdAt))
    .limit(limit);
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

export async function facetCounts(): Promise<Record<'type' | 'niche' | 'style' | 'color' | 'columns', Record<string, number>>> {
  const rows = await db.select({
    type: layouts.type, niche: layouts.niche, style: layouts.style, colors: layouts.colors, variant: layouts.variant,
  }).from(layouts).where(eq(layouts.status, 'published'));

  const counts = { type: {}, niche: {}, style: {}, color: {}, columns: {} } as Record<'type' | 'niche' | 'style' | 'color' | 'columns', Record<string, number>>;
  const bump = (axis: 'type' | 'niche' | 'style' | 'color' | 'columns', key: string | null) => {
    if (!key) return;
    counts[axis][key] = (counts[axis][key] ?? 0) + 1;
  };
  for (const r of rows) {
    bump('type', r.type);
    bump('niche', r.niche);
    bump('style', r.style);
    for (const c of r.colors ?? []) bump('color', c);
    if (r.variant?.columns != null) bump('columns', String(r.variant.columns));
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
