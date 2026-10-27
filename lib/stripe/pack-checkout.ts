import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/db/client';
import { packs } from '@/db/schema';

export interface PackForCheckout {
  id: string;
  slug: string;
  status: string;
  kind: 'free' | 'paid';
  priceCents: number | null;
}

/** The pack row checkout needs, or null when there is none. */
export async function resolvePackForCheckout(packId: string): Promise<PackForCheckout | null> {
  const rows = await db
    .select({ id: packs.id, slug: packs.slug, status: packs.status, kind: packs.kind, priceCents: packs.priceCents })
    .from(packs).where(eq(packs.id, packId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Every theme pack is sold on ONE Stripe Price (env STRIPE_THEME_PACK). The site shows the pack's own
 * `price_cents`, so checkout must never charge something else: the price must be active, one-time, in USD and
 * equal to the pack's price. Returns why it is not, or null when it is safe to charge.
 */
export function themePackPriceProblem(
  price: Pick<Stripe.Price, 'active' | 'type' | 'currency' | 'unit_amount'>,
  packPriceCents: number | null,
): 'inactive' | 'not_one_time' | 'wrong_currency' | 'amount_mismatch' | null {
  if (!price.active) return 'inactive';
  if (price.type !== 'one_time') return 'not_one_time';
  if (price.currency !== 'usd') return 'wrong_currency';
  if (price.unit_amount == null || packPriceCents == null || price.unit_amount !== packPriceCents) return 'amount_mismatch';
  return null;
}
