import { and, eq, ne, asc, desc, sql, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, packs, packLayouts } from '@/db/schema';
import { buildLayoutFilters } from './query-builder';
import { type CatalogFilters } from './filters';
import { mergeCatalogOrder } from './merge-order';

export type LayoutRow = typeof layouts.$inferSelect;
export type PackRow = typeof packs.$inferSelect;

export async function listLayouts(f: CatalogFilters): Promise<LayoutRow[]> {
  const { where, orderBy, limit, offset } = buildLayoutFilters(f);
  // id breaks ties: many layouts share one created_at, and an unstable order repeats or skips items across pages.
  return db.select().from(layouts).where(where).orderBy(orderBy, asc(layouts.id)).limit(limit).offset(offset);
}

/** Total published layouts matching the same filters (for pagination). */
export async function countLayouts(f: CatalogFilters): Promise<number> {
  const { where } = buildLayoutFilters(f);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(layouts).where(where);
  return row?.n ?? 0;
}

/** All published layouts, newest first. Used to build the homepage category sections. */
export async function listPublishedLayouts(): Promise<LayoutRow[]> {
  return db.select().from(layouts)
    .where(eq(layouts.status, 'published'))
    .orderBy(desc(layouts.publishedAt), desc(layouts.createdAt));
}

/** Sibling elements of the same type (variant navigation): same type, others first by niche match. */
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

// A layout is "paid-only" when it belongs to a published paid pack and to no published free pack
// (the SQL twin of isPaidOnlyLayout in lib/stripe/entitlements). Such a layout is sold with its pack.
const inPaidPack = sql`EXISTS (
  SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
  WHERE pl.layout_id = ${layouts.id} AND p.status = 'published' AND p.kind = 'paid')`;
const inFreePack = sql`EXISTS (
  SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
  WHERE pl.layout_id = ${layouts.id} AND p.status = 'published' AND p.kind = 'free')`;
const paidOnlyLayout = sql`(${inPaidPack} AND NOT ${inFreePack})`;

/**
 * Layouts downloadable for free: the complement of isPaidOnlyLayout
 * (lib/stripe/entitlements): a layout is free unless EVERY published pack it
 * belongs to is paid. So: no paid pack, or at least one free pack.
 */
export async function listFreeLayouts(limit = 48): Promise<LayoutRow[]> {
  return db
    .select()
    .from(layouts)
    .where(and(eq(layouts.status, 'published'), sql`NOT ${paidOnlyLayout}`))
    .orderBy(desc(layouts.publishedAt), desc(layouts.createdAt))
    .limit(limit);
}

export type PackItem = { pack: PackRow; pageCount: number };

export type CatalogItem =
  | { kind: 'pack'; pack: PackRow; pageCount: number }
  | { kind: 'layout'; layout: LayoutRow };

/**
 * One page of a catalog listing in which a paid pack appears ONCE, as a pack card, instead of as
 * its individual pages (the pages stay public at /layouts/<slug> for preview and SEO, they are just
 * not listed one by one: the pack is the product). A pack is listed when at least one of its
 * paid-only pages matches the filters; every other layout is listed as before. Packs and layouts
 * are ordered TOGETHER by the chosen sort (newest first by default), so a new free layout is not
 * pushed below every older pack; `items` is that combined page, `packs` and `layouts` are the same
 * rows split by kind. `page` slices the combined list, so `total` counts packs + layouts.
 */
export async function listCatalogItems(f: CatalogFilters): Promise<{ items: CatalogItem[]; packs: PackItem[]; layouts: LayoutRow[]; total: number }> {
  const { conditions, orderBy, limit, offset } = buildLayoutFilters(f);
  const where = and(...conditions);

  const packOrder = f.sort === 'oldest' ? [asc(packs.createdAt), asc(packs.title), asc(packs.id)]
    : f.sort === 'title' ? [asc(packs.title), asc(packs.id)]
    : [desc(packs.createdAt), asc(packs.title), asc(packs.id)];
  const matchesPack = sql`EXISTS (
    SELECT 1 FROM pack_layouts pl WHERE pl.pack_id = ${packs.id} AND pl.layout_id IN (
      SELECT ${layouts.id} FROM ${layouts} WHERE ${where} AND ${paidOnlyLayout}))`;
  const matched = await db.select().from(packs)
    .where(and(eq(packs.status, 'published'), eq(packs.kind, 'paid'), matchesPack))
    .orderBy(...packOrder);

  const layoutWhere = and(where, sql`NOT ${paidOnlyLayout}`);
  // The first `offset + limit` layouts, as light keys: the merged page can hold at most that many
  // of them, and which ones is only known after the merge.
  const [layoutKeys, [totalRow]] = await Promise.all([
    db.select({ id: layouts.id, createdAt: layouts.createdAt, title: layouts.title }).from(layouts)
      .where(layoutWhere).orderBy(orderBy, asc(layouts.id)).limit(offset + limit),
    db.select({ n: sql<number>`count(*)::int` }).from(layouts).where(layoutWhere),
  ]);

  const window = mergeCatalogOrder(matched, layoutKeys, f.sort).slice(offset, offset + limit);
  const packIds = window.filter((r) => r.kind === 'pack').map((r) => r.id);
  const layoutIds = window.filter((r) => r.kind === 'layout').map((r) => r.id);

  const [layoutRows, countRows] = await Promise.all([
    layoutIds.length ? db.select().from(layouts).where(inArray(layouts.id, layoutIds)) : Promise.resolve([] as LayoutRow[]),
    packIds.length
      ? db.select({ packId: packLayouts.packId, n: sql<number>`count(*)::int` }).from(packLayouts)
          .innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
          .where(and(inArray(packLayouts.packId, packIds), eq(layouts.status, 'published')))
          .groupBy(packLayouts.packId)
      : Promise.resolve([] as { packId: string; n: number }[]),
  ]);
  const pageCounts = new Map(countRows.map((r) => [r.packId, r.n]));
  const packById = new Map(matched.map((p) => [p.id, p]));
  const layoutById = new Map(layoutRows.map((l) => [l.id, l]));

  const items: CatalogItem[] = [];
  for (const ref of window) {
    if (ref.kind === 'pack') {
      const pack = packById.get(ref.id);
      if (pack) items.push({ kind: 'pack', pack, pageCount: pageCounts.get(pack.id) ?? 0 });
    } else {
      const layout = layoutById.get(ref.id);
      if (layout) items.push({ kind: 'layout', layout });
    }
  }
  return {
    items,
    packs: items.flatMap((i) => (i.kind === 'pack' ? [{ pack: i.pack, pageCount: i.pageCount }] : [])),
    layouts: items.flatMap((i) => (i.kind === 'layout' ? [i.layout] : [])),
    total: matched.length + (totalRow?.n ?? 0),
  };
}

export async function getLayoutBySlug(slug: string): Promise<LayoutRow | null> {
  const rows = await db.select().from(layouts)
    .where(and(eq(layouts.slug, slug), eq(layouts.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function listPacks(): Promise<PackRow[]> {
  // Newest first: the latest pack leads the list, the homepage band and the menus; the title only breaks ties.
  return db.select().from(packs).where(eq(packs.status, 'published')).orderBy(desc(packs.createdAt), asc(packs.title));
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
