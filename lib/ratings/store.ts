import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { ratings, layouts } from '@/db/schema';
import { clampStars, ratingAverage } from './compute';

export interface RatingResult {
  count: number;
  sum: number;
  average: number;
  yourStars: number;
}

// Upsert one rating per (layout, rater) and recompute the layout's denormalized
// aggregate. Returns the fresh aggregate + the rater's own stars.
export async function submitRating(input: {
  layoutId: string;
  raterId: string;
  stars: number;
  userId?: string | null;
}): Promise<RatingResult> {
  const stars = clampStars(input.stars);
  await db
    .insert(ratings)
    .values({ id: randomUUID(), layoutId: input.layoutId, raterId: input.raterId, userId: input.userId ?? null, stars })
    .onConflictDoUpdate({
      target: [ratings.layoutId, ratings.raterId],
      set: { stars, userId: input.userId ?? null, createdAt: new Date() },
    });

  const [agg] = await db
    .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${ratings.stars}), 0)::int` })
    .from(ratings)
    .where(eq(ratings.layoutId, input.layoutId));

  await db.update(layouts).set({ ratingCount: agg.count, ratingSum: agg.sum }).where(eq(layouts.id, input.layoutId));

  return { count: agg.count, sum: agg.sum, average: ratingAverage(agg.sum, agg.count), yourStars: stars };
}

/** The rater's existing stars for a layout (0 if none), for hydrating the widget. */
export async function getRaterStars(layoutId: string, raterId: string): Promise<number> {
  const rows = await db
    .select({ stars: ratings.stars })
    .from(ratings)
    .where(and(eq(ratings.layoutId, layoutId), eq(ratings.raterId, raterId)))
    .limit(1);
  return rows[0]?.stars ?? 0;
}
