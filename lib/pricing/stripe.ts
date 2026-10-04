import { env } from '@/lib/env';
import { PRICING, type TierId } from './config';

/**
 * Get the Stripe Price ID for a tier.
 * Returns undefined if the tier is not found or the priceEnv is not set.
 */
export function priceIdForTier(tierId: TierId | null | string): string | undefined {
  if (!tierId) return undefined;
  const tier = PRICING.tiers.find((t) => t.id === tierId);
  if (!tier) return undefined;
  const envKey = tier.priceEnv;
  return (env as Record<string, string | undefined>)[envKey];
}

/**
 * Get the lifetime price ID.
 * Returns undefined if the priceEnv is not set.
 */
export function lifetimePriceId(): string | undefined {
  const envKey = PRICING.lifetime.priceEnv;
  return (env as Record<string, string | undefined>)[envKey];
}

/**
 * Get the founding coupon ID.
 * Returns undefined if the couponEnv is not set.
 */
export function foundingCouponId(): string | undefined {
  const envKey = PRICING.founding.couponEnv;
  return (env as Record<string, string | undefined>)[envKey];
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
