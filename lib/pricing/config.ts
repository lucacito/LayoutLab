import { z } from 'zod';
import pricingJson from '@/config/pricing.json';

export type TierId = 'personal' | 'freelancer' | 'agency';

export interface Tier {
  id: TierId;
  label: string;
  sites: number | null;
  priceCents: number;
  priceEnv: string;
}

const TierSchema = z.object({
  id: z.enum(['personal', 'freelancer', 'agency']),
  label: z.string(),
  sites: z.number().nullable(),
  priceCents: z.number(),
  priceEnv: z.string(),
});

const PricingConfigSchema = z.object({
  version: z.number(),
  product: z.string(),
  currency: z.string(),
  tiers: z.array(TierSchema),
  founding: z.object({
    percentOff: z.number(),
    cap: z.number(),
    couponEnv: z.string(),
  }),
  lifetime: z.object({
    tier: z.string(),
    priceCents: z.number(),
    cap: z.number(),
    priceEnv: z.string(),
  }),
  trial: z.object({
    tier: z.string(),
    days: z.number(),
    requireCard: z.boolean(),
  }),
  renewalReminderDays: z.array(z.number()),
  refundWindowDays: z.number(),
  pastDueGraceDays: z.number(),
  urls: z.object({
    pricing: z.string(),
    account: z.string(),
    billing: z.string(),
  }),
});

export type PricingConfig = z.infer<typeof PricingConfigSchema>;

// Parse and validate the pricing config at module load time
export const PRICING: PricingConfig = PricingConfigSchema.parse(pricingJson);

/**
 * Get a tier by ID. Returns undefined if not found.
 */
export function getTier(id: string): Tier | undefined {
  return PRICING.tiers.find((t) => t.id === id);
}

/**
 * Get the site limit for a tier ID.
 * Returns null for null id, unlimited tier, or unknown id.
 */
export function tierSiteLimit(id: string | null): number | null {
  if (!id) return null;
  const tier = getTier(id);
  if (!tier) return null;
  return tier.sites;
}

/**
 * Format a price in cents as USD. E.g., 4900 -> "$49"
 */
export function formatUsd(cents: number): string {
  const dollars = Math.floor(cents / 100);
  return `$${dollars}`;
}

/**
 * Calculate prorated upgrade cost.
 * @param oldCents Current tier price in cents
 * @param newCents New tier price in cents
 * @param remainingMs Milliseconds remaining in the current billing period
 * @param periodMs Total milliseconds in one billing period
 * @returns Prorated upgrade cost in cents, clamped to [0, newCents - oldCents]
 */
export function proratedUpgradeCents(
  oldCents: number,
  newCents: number,
  remainingMs: number,
  periodMs: number,
): number {
  // If downgrading, no cost
  if (newCents <= oldCents) return 0;

  // Clamp remaining to [0, period]
  const clamped = Math.max(0, Math.min(remainingMs, periodMs));

  // Calculate prorated difference: (new - old) * (remaining / period)
  const difference = newCents - oldCents;
  const prorated = difference * (clamped / periodMs);

  // Round and return
  return Math.round(prorated);
}

/**
 * Check if a price env variable is set in the server environment.
 * Used to determine if a tier is available for purchase.
 */
export function isPriceEnvSet(priceEnv: string): boolean {
  const value = process.env[priceEnv];
  return !!value;
}

/** The cheapest tier (the config guarantees at least one, ordered by price). */
export function lowestTier(): Tier {
  return PRICING.tiers.reduce((a, b) => (b.priceCents < a.priceCents ? b : a));
}

/** "1 site", "10 sites", "Unlimited sites": the wording for a tier's site limit, from the config. */
export function siteLabel(tier: Tier): string {
  if (tier.sites === null) return 'Unlimited sites';
  return tier.sites === 1 ? '1 site' : `${tier.sites} sites`;
}

/** Copy-ready values for the offers around the tiers, all read from the config. */
export const OFFER = {
  trialDays: PRICING.trial.days,
  foundingPercent: PRICING.founding.percentOff,
  foundingCap: PRICING.founding.cap,
  lifetimeCap: PRICING.lifetime.cap,
} as const;
