import type Stripe from 'stripe';
import { getTier } from '@/lib/pricing/config';
import type { PurchaseOrder } from '@/lib/email/license-email';

/** The money facts Stripe reports for a completed checkout (no plan wording yet). */
export type PurchaseFacts = Omit<PurchaseOrder, 'planLabel'>;

/**
 * Read what was paid from a completed checkout session. Returns undefined when Stripe reported no amount or no
 * currency, so the purchase email never shows an invented receipt. A zero amount (a no-card trial) is real and kept.
 */
export function purchaseFactsFromSession(s: Stripe.Checkout.Session): PurchaseFacts | undefined {
  if (typeof s.amount_total !== 'number' || typeof s.currency !== 'string' || s.currency === '') return undefined;
  // One-time payments have a payment intent; subscriptions have an invoice; the session id is the last resort.
  const reference = typeof s.payment_intent === 'string' ? s.payment_intent
    : typeof s.invoice === 'string' ? s.invoice
    : s.id;
  return {
    amountCents: s.amount_total,
    discountCents: s.total_details?.amount_discount ?? 0,
    currency: s.currency,
    paidAt: new Date(s.created * 1000),
    reference,
  };
}

/** Add the plan wording the buyer will recognise: the tier and how it was bought. */
export function buildPurchaseOrder(facts: PurchaseFacts, plan: { tier?: string | null; lifetime?: boolean; trial?: boolean }): PurchaseOrder {
  const tier = plan.tier ? getTier(plan.tier) : undefined;
  const how = plan.trial ? 'free trial' : plan.lifetime ? 'Lifetime' : 'annual';
  return { ...facts, planLabel: tier ? `${tier.label} (${how})` : 'Annual licence' };
}
