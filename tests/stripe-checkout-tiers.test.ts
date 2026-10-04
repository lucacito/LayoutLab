import { describe, it, expect } from 'vitest';
import { buildCheckoutSessionParams, type CheckoutInput, type CheckoutContext } from '@/lib/stripe/checkout';

describe('buildCheckoutSessionParams for tiers', () => {
  const baseCtx: CheckoutContext = {
    siteUrl: 'https://example.com',
    pluginPriceId: 'price_personal',
    automaticTax: false,
    requireTermsConsent: false,
  };

  it('builds a trial session for ai-editor-divi5-pro with no tier and no lifetime', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'ai-editor-divi5-pro' };
    const params = buildCheckoutSessionParams(input, baseCtx);

    expect(params.mode).toBe('subscription');
    expect(params.subscription_data?.trial_period_days).toBe(45);
    expect(params.subscription_data?.trial_settings?.end_behavior.missing_payment_method).toBe('cancel');
    expect(params.payment_method_collection).toBe('if_required');
    expect(params.metadata).toMatchObject({
      kind: 'plugin',
      product: 'ai-editor-divi5-pro',
      tier: '0',
      founding: '0',
      lifetime: '0',
    });
    expect(params.allow_promotion_codes).toBe(true);
  });

  it('builds a yearly subscription for a specific tier (personal)', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'personal' };
    const params = buildCheckoutSessionParams(input, baseCtx);

    expect(params.mode).toBe('subscription');
    expect(params.subscription_data?.trial_period_days).toBeUndefined();
    expect(params.payment_method_collection).toBeUndefined();
    expect(params.metadata).toMatchObject({
      kind: 'plugin',
      product: 'ai-editor-divi5-pro',
      tier: 'personal',
      founding: '0',
      lifetime: '0',
    });
    expect(params.allow_promotion_codes).toBe(true);
  });

  it('applies founding discount when founding is true and coupon is provided', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'personal' };
    const ctx: CheckoutContext = { ...baseCtx, founding: true, foundingCouponId: 'coupon_founding' };
    const params = buildCheckoutSessionParams(input, ctx);

    expect(params.mode).toBe('subscription');
    expect(params.discounts).toEqual([{ coupon: 'coupon_founding' }]);
    expect(params.metadata).toMatchObject({ founding: '1' });
    expect(params.allow_promotion_codes).toBe(false);
  });

  it('builds a lifetime payment session with mode:payment', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'ai-editor-divi5-pro', lifetime: true };
    const ctx: CheckoutContext = { ...baseCtx, lifetime: true };
    const params = buildCheckoutSessionParams(input, ctx);

    expect(params.mode).toBe('payment');
    expect(params.subscription_data).toBeUndefined();
    expect(params.payment_method_collection).toBeUndefined();
    expect(params.metadata).toMatchObject({
      kind: 'plugin',
      product: 'ai-editor-divi5-pro',
      tier: 'agency',
      lifetime: '1',
    });
  });

  it('does not combine founding with allow_promotion_codes', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'freelancer' };
    const ctx: CheckoutContext = { ...baseCtx, founding: true, foundingCouponId: 'coupon_id' };
    const params = buildCheckoutSessionParams(input, ctx);

    expect(params.allow_promotion_codes).toBe(false);
  });

  it('handles other plugin products without tier/lifetime fields', () => {
    const input: CheckoutInput = { kind: 'plugin', product: 'elementor-to-divi5-pro' };
    const params = buildCheckoutSessionParams(input, baseCtx);

    expect(params.mode).toBe('subscription');
    expect(params.payment_method_collection).toBeUndefined();
    expect(params.allow_promotion_codes).toBe(true);
    expect(params.metadata).toMatchObject({ kind: 'plugin', product: 'elementor-to-divi5-pro' });
  });
});
