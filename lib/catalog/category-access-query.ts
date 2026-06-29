import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, packLayouts, packs } from '@/db/schema';
import type { CategoryAccess } from './category-access';

// A taxonomy value is FREE if at least one published layout in that category
// belongs to a free pack; otherwise PAID. Computed from real pack membership,
// cached per request. Fails closed (everything PAID) if the DB is unreachable so
// the header never crashes the page. Server-only (imports the DB / `pg`).
export const getCategoryAccess = cache(async (): Promise<CategoryAccess> => {
  const out: CategoryAccess = { type: {}, niche: {}, style: {} };
  try {
    const rows = await db
      .select({ type: layouts.type, niche: layouts.niche, style: layouts.style })
      .from(layouts)
      .innerJoin(packLayouts, eq(packLayouts.layoutId, layouts.id))
      .innerJoin(packs, eq(packs.id, packLayouts.packId))
      .where(and(eq(layouts.status, 'published'), eq(packs.kind, 'free')));
    for (const r of rows) {
      if (r.type) out.type[r.type] = 'free';
      if (r.niche) out.niche[r.niche] = 'free';
      if (r.style) out.style[r.style] = 'free';
    }
  } catch {
    /* fail closed → all PAID */
  }
  return out;
});
