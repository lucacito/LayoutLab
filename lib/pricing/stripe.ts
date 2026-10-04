import { env } from '@/lib/env';
import { PRICING, type TierId, isStripePriceId, isCouponId } from './config';

/**
 * Get the Stripe Price ID for a tier.
 * Returns undefined if the tier is not found or the priceEnv is not set.
 */
export function priceIdForTier(tierId: TierId | null | string): string | undefined {
  if (!tierId) return undefined;
  const tier = PRICING.tiers.find((t) => t.id === tierId);
  if (!tier) return undefined;
  const value = (env as Record<string, string | undefined>)[tier.priceEnv];
  // A value that is not a Stripe price id (a pasted label) counts as 'not configured', never as a price.
  return isStripePriceId(value) ? value : undefined;
}

/**
 * Get the lifetime price ID.
 * Returns undefined if the priceEnv is not set.
 */
export function lifetimePriceId(): string | undefined {
  const value = (env as Record<string, string | undefined>)[PRICING.lifetime.priceEnv];
  return isStripePriceId(value) ? value : undefined;
}

/**
 * Get the founding coupon ID.
 * Returns undefined if the couponEnv is not set.
 */
export function foundingCouponId(): string | undefined {
  const value = (env as Record<string, string | undefined>)[PRICING.founding.couponEnv];
  return isCouponId(value) ? value : undefined;
}

/**
 * Derive tier ID from a Stripe Price ID.
 * Returns the tier id or null if not found.
 */
export function tierForPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  for (const tier of PRICING.tiers) {
    const envKey = tier.priceEnv;
    const tierPriceId = (env as Record<string, string | undefined>)[envKey];
    if (tierPriceId === priceId) {
      return tier.id;
    }
  }
  return null;
}

/**
 * Check if founding discount is still available (hasn't reached the cap).
 * Takes the current founding count from the database.
 */
export function foundingAvailable(count: number): boolean {
  return count < PRICING.founding.cap;
}

/**
 * Check if lifetime tier is still available (hasn't reached the cap).
 * Takes the current lifetime count from the database.
 */
export function lifetimeAvailable(count: number): boolean {
  return count < PRICING.lifetime.cap;
}
