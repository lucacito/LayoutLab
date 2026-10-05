import { describe, it, expect } from 'vitest';
import { buildCheckoutSessionParams, type CheckoutContext } from '@/lib/stripe/checkout';
import { PRICING } from '@/lib/pricing/config';

const ctx: CheckoutContext = { siteUrl: 'https://divi5lab.com', pluginPriceId: 'price_x', automaticTax: false };
const product = 'ai-editor-divi5-pro' as const;

describe('AI Editor tier sessions', () => {
  it('a plain Personal purchase is paid up front: no trial, card collected, promo codes allowed', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'personal' }, ctx);
    expect(p.mode).toBe('subscription');
    expect(p.payment_method_collection).toBeUndefined();
    expect((p.subscription_data as any).trial_period_days).toBeUndefined();
    expect(p.allow_promotion_codes).toBe(true);
    expect(p.metadata).toEqual({ kind: 'plugin', product, tier: 'personal', founding: '0', lifetime: '0', trial: '0' });
    expect((p.subscription_data as any).metadata).toEqual(p.metadata);
  });

  it('the trial is Personal only, lasts PRICING.trial.days and takes no card when the config says so', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'personal', trial: true }, ctx);
    const sub = p.subscription_data as any;
    expect(sub.trial_period_days).toBe(PRICING.trial.days);
    expect(PRICING.trial.requireCard).toBe(false);
    expect(p.payment_method_collection).toBe('if_required');
    expect(sub.trial_settings.end_behavior.missing_payment_method).toBe('cancel');
    expect(p.metadata).toMatchObject({ tier: 'personal', trial: '1' });
  });

  it('a trial flag on another tier is ignored by the builder (the route rejects it earlier)', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'agency', trial: true }, ctx);
    expect((p.subscription_data as any).trial_period_days).toBeUndefined();
    expect(p.metadata).toMatchObject({ trial: '0' });
  });

  it('founding adds the coupon, drops allow_promotion_codes and flags the licence', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'freelancer' }, { ...ctx, founding: true, foundingCouponId: 'co_f' });
    expect(p.discounts).toEqual([{ coupon: 'co_f' }]);
    expect(p.allow_promotion_codes).toBeUndefined();
    expect(p.metadata).toMatchObject({ founding: '1' });
  });

  it('a trial never takes the founding coupon, so a no-card trial cannot use up a limited redemption', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'personal', trial: true }, { ...ctx, founding: true, foundingCouponId: 'co_f' });
    expect(p.discounts).toBeUndefined();
    expect(p.metadata).toMatchObject({ founding: '0', trial: '1' });
  });

  it('founding without a coupon id is not applied', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'agency' }, { ...ctx, founding: true });
    expect(p.discounts).toBeUndefined();
    expect(p.metadata).toMatchObject({ founding: '0' });
  });

  it('lifetime is a one-time payment on the lifetime tier with no subscription data; without the founding flag it is full price', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, lifetime: true }, ctx);
    expect(p.mode).toBe('payment');
    expect((p as any).subscription_data).toBeUndefined();
    expect(p.discounts).toBeUndefined();
    expect(p.customer_creation).toBe('always');
    expect(p.allow_promotion_codes).toBeUndefined();
    expect(p.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 30 * 60);
    expect(p.expires_at).toBeLessThan(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
    expect(p.metadata).toEqual({ kind: 'plugin', product, tier: PRICING.lifetime.tier, founding: '0', lifetime: '1', trial: '0' });
  });

  it('lifetime with the founding flag takes the founding coupon and records founding in the metadata', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, lifetime: true }, { ...ctx, founding: true, foundingCouponId: 'co_f' });
    expect(p.mode).toBe('payment');
    expect(p.discounts).toEqual([{ coupon: 'co_f' }]);
    expect((p as any).subscription_data).toBeUndefined();
    // Stripe rejects discounts together with allow_promotion_codes, and a lifetime session never takes promo codes.
    expect(p.allow_promotion_codes).toBeUndefined();
    expect(p.customer_creation).toBe('always');
    expect(p.metadata).toEqual({ kind: 'plugin', product, tier: PRICING.lifetime.tier, founding: '1', lifetime: '1', trial: '0' });
  });

  it('lifetime with the founding flag but no coupon id stays full price', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, lifetime: true }, { ...ctx, founding: true });
    expect(p.discounts).toBeUndefined();
    expect(p.metadata).toMatchObject({ founding: '0', lifetime: '1' });
  });

  it('other products keep the exact legacy session', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product: 'wpbakery-to-divi5-pro' }, ctx);
    expect(p.metadata).toEqual({ kind: 'plugin', product: 'wpbakery-to-divi5-pro' });
    expect(p.allow_promotion_codes).toBe(true);
    expect((p.subscription_data as any).trial_period_days).toBeUndefined();
  });

  it('the AI Editor checkout discloses its own refund policy, not "all sales are final and non-refundable"', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, tier: 'personal' }, { ...ctx, siteUrl: 'https://divi5lab.com' });
    const msg = (p.custom_text as any).submit.message as string;
    expect(msg).toContain('https://divi5lab.com/license#refunds');
    expect(msg).toContain(`within ${PRICING.refundWindowDays} days`);
    expect(msg.toLowerCase()).not.toContain('non-refundable');
    expect(msg.length).toBeLessThanOrEqual(1200);
  });

  it('converters keep the original disclosure', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product: 'wpbakery-to-divi5-pro' }, { ...ctx, siteUrl: 'https://divi5lab.com' });
    expect((p.custom_text as any).submit.message).toContain('non-refundable');
  });
});

describe('invoices for one-time Lifetime payments', () => {
  it('a Lifetime session asks Stripe to create an invoice, so the buyer and their bookkeeper get a real invoice PDF', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, lifetime: true }, ctx);
    expect(p.mode).toBe('payment');
    expect(p.invoice_creation).toEqual({ enabled: true });
  });

  it('a Lifetime session with the founding coupon keeps both the discount and the invoice', () => {
    const p = buildCheckoutSessionParams({ kind: 'plugin', product, lifetime: true }, { ...ctx, founding: true, foundingCouponId: 'co_f' });
    expect(p.discounts).toEqual([{ coupon: 'co_f' }]);
    expect(p.invoice_creation).toEqual({ enabled: true });
  });

  it('subscriptions never set invoice_creation (Stripe rejects it outside payment mode; they invoice by themselves)', () => {
    for (const tier of ['personal', 'freelancer', 'agency']) {
      expect(buildCheckoutSessionParams({ kind: 'plugin', product, tier }, ctx)).not.toHaveProperty('invoice_creation');
    }
  });
});
