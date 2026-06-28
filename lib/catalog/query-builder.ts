import { and, eq, inArray, ilike, or, arrayOverlaps, asc, desc, type SQL } from 'drizzle-orm';
import { layouts } from '@/db/schema';
import { type CatalogFilters, PAGE_SIZE } from './filters';

export function buildLayoutFilters(f: CatalogFilters) {
  const conditions: SQL[] = [eq(layouts.status, 'published')];
  if (f.type.length) conditions.push(inArray(layouts.type, f.type));
  if (f.niche.length) conditions.push(inArray(layouts.niche, f.niche));
  if (f.style.length) conditions.push(inArray(layouts.style, f.style));
  if (f.color.length) conditions.push(arrayOverlaps(layouts.colors, f.color));
  if (f.q) {
    conditions.push(or(ilike(layouts.title, `%${f.q}%`), ilike(layouts.description, `%${f.q}%`)) as SQL);
  }

  const orderBy = f.sort === 'oldest' ? asc(layouts.createdAt)
    : f.sort === 'title' ? asc(layouts.title)
    : desc(layouts.createdAt);

  return {
    conditions,
    where: and(...conditions),
    orderBy,
    limit: PAGE_SIZE,
    offset: (f.page - 1) * PAGE_SIZE,
  };
}
