import { db } from '@/db/client';
import { licenses } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { PRICING } from './config';

/**
 * Count how many founding or lifetime licenses have been sold.
 * Returns null if the database query fails (so UI can gracefully hide the counter).
 */
export async function countFoundingLicenses(): Promise<number | null> {
  try {
    const result = await db
      .select({ count: count() })
      .from(licenses)
      .where(
        and(
          eq(licenses.productSlug, PRICING.product),
          eq(licenses.founding, true),
        ),
      );
    return result[0]?.count ?? 0;
  } catch {
    return null;
  }
}

export async function countLifetimeLicenses(): Promise<number | null> {
  try {
    const result = await db
      .select({ count: count() })
      .from(licenses)
      .where(
        and(
          eq(licenses.productSlug, PRICING.product),
          eq(licenses.lifetime, true),
        ),
      );
    return result[0]?.count ?? 0;
  } catch {
    return null;
  }
}

/**
 * Get availability status for founding and lifetime offers.
 * Returns null on error.
 */
export async function getAvailability(): Promise<{
  founding: { count: number; remaining: number; available: boolean };
  lifetime: { count: number; remaining: number; available: boolean };
} | null> {
  const foundingCount = await countFoundingLicenses();
  const lifetimeCount = await countLifetimeLicenses();

  if (foundingCount === null || lifetimeCount === null) return null;

  return {
    founding: {
      count: foundingCount,
      remaining: Math.max(0, PRICING.founding.cap - foundingCount),
      available: foundingCount < PRICING.founding.cap,
    },
    lifetime: {
      count: lifetimeCount,
      remaining: Math.max(0, PRICING.lifetime.cap - lifetimeCount),
      available: lifetimeCount < PRICING.lifetime.cap,
    },
  };
}
