import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { buildPurchaseOrder, purchaseFactsFromSession } from '@/lib/stripe/order';

const facts = { amountCents: 31430, discountCents: 13470, currency: 'usd', paidAt: new Date('2026-10-04T15:00:00Z'), reference: 'pi_1' };

describe('buildPurchaseOrder: the plan label on the receipt', () => {
  it('lifetime: the tier label and Lifetime', () => {
    expect(buildPurchaseOrder(facts, { tier: 'agency', lifetime: true }).planLabel).toBe('Agency (Lifetime)');
  });
  it('annual tier', () => {
    expect(buildPurchaseOrder(facts, { tier: 'personal' }).planLabel).toBe('Personal (annual)');
  });
  it('trial', () => {
    expect(buildPurchaseOrder({ ...facts, amountCents: 0, discountCents: 0 }, { tier: 'personal', trial: true }).planLabel).toBe('Personal (free trial)');
  });
  it('a converter (no tier) is an annual licence', () => {
    expect(buildPurchaseOrder(facts, {}).planLabel).toBe('Annual licence');
  });
  it('an unknown tier id falls back instead of throwing', () => {
    expect(buildPurchaseOrder(facts, { tier: 'gone' }).planLabel).toBe('Annual licence');
  });
  it('keeps the money facts as given', () => {
    const o = buildPurchaseOrder(facts, { tier: 'agency', lifetime: true });
    expect([o.amountCents, o.discountCents, o.currency, o.reference]).toEqual([31430, 13470, 'usd', 'pi_1']);
  });
});

describe('purchaseFactsFromSession: what Stripe reports', () => {
  const session = (over: Record<string, unknown>) => ({ id: 'cs_1', created: 1790000000, currency: 'usd', amount_total: 31430, total_details: { amount_discount: 13470 }, ...over }) as unknown as Stripe.Checkout.Session;

  it('reads amount, discount, currency and date; the reference is the payment intent for a one-time payment', () => {
    expect(purchaseFactsFromSession(session({ payment_intent: 'pi_9' }))).toEqual({
      amountCents: 31430, discountCents: 13470, currency: 'usd', paidAt: new Date(1790000000 * 1000), reference: 'pi_9',
    });
  });
  it('the reference is the invoice for a subscription', () => {
    expect(purchaseFactsFromSession(session({ invoice: 'in_5' }))?.reference).toBe('in_5');
  });
  it('falls back to the checkout session id', () => {
    expect(purchaseFactsFromSession(session({}))?.reference).toBe('cs_1');
  });
  it('a missing discount is 0', () => {
    expect(purchaseFactsFromSession(session({ total_details: undefined }))?.discountCents).toBe(0);
  });
  it('returns undefined when Stripe reported no amount, so no receipt is invented', () => {
    expect(purchaseFactsFromSession(session({ amount_total: null }))).toBeUndefined();
    expect(purchaseFactsFromSession(session({ amount_total: undefined }))).toBeUndefined();
  });
  it('a zero amount (a no-card trial) is real: it is kept', () => {
    expect(purchaseFactsFromSession(session({ amount_total: 0, total_details: { amount_discount: 0 } }))?.amountCents).toBe(0);
  });
  it('a session with no usable currency has no receipt', () => {
    expect(purchaseFactsFromSession(session({ currency: null }))).toBeUndefined();
  });
});
