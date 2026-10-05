import type Stripe from 'stripe';
import type { PluginProduct } from '@/lib/license-server/core';
import { PRICING } from '@/lib/pricing/config';

export type CheckoutInput =
  | { kind: 'pack'; packId: string }
  | { kind: 'membership'; plan: 'monthly' | 'yearly' }
  | { kind: 'plugin'; product: PluginProduct; tier?: string; lifetime?: boolean; trial?: boolean };

export interface CheckoutContext {
  siteUrl: string;
  packPriceId?: string;
  membershipPriceId?: string;
  pluginPriceId?: string;
  email?: string;
  automaticTax: boolean;
  /**
   * When true, Checkout collects an express, affirmative consent (a required
   * checkbox) that the buyer agrees to immediate delivery of digital goods and
   * thereby waives the statutory right of withdrawal/refund. This is what makes
   * a "no refunds" policy lawful for EU/UK consumers (Consumer Rights Directive
   * art. 16(m) / UK CCR reg. 37). Off by default because Stripe requires a Terms
   * of Service URL configured in the Dashboard when this is enabled, so turning it
   * on without that URL makes session creation fail. Point that Dashboard URL at
   * `${siteUrl}/license`.
   */
  requireTermsConsent?: boolean;
  /** AI Editor only: apply the founding coupon (the route has already checked the cap). Never combined with a trial. */
  founding?: boolean;
  foundingCouponId?: string;
}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Stripe.Checkout.SessionCreateParams {
  // Disclosed on every checkout (satisfies the "state the policy at checkout"
  // requirement, and is sufficient disclosure for US buyers).
  const aiEditor = input.kind === 'plugin' && input.product === PRICING.product;
  const submitMessage = aiEditor
    ? `Digital goods are delivered instantly. A plan purchase is final except in the cases listed in our refund policy (charged in error, cannot be activated, or a renewal you ask about within ${PRICING.refundWindowDays} days). Cancel any time; if a licence ends, everything keeps working and only updates and support stop. Full policy: ${ctx.siteUrl}/license#refunds`
    : `Digital goods are delivered instantly. By completing your purchase you consent to immediate delivery and agree that all sales are final and non-refundable. Full License & Refund policy: ${ctx.siteUrl}/license`;

  const customText: Stripe.Checkout.SessionCreateParams.CustomText = {
    submit: { message: submitMessage },
    ...(ctx.requireTermsConsent
      ? {
          terms_of_service_acceptance: {
            message:
              'I request and consent to immediate delivery of this digital product, and I understand that I therefore lose my right to cancel or receive a refund once the download is available.',
          },
        }
      : {}),
  };

  const common: Stripe.Checkout.SessionCreateParams = {
    success_url: `${ctx.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ctx.siteUrl}/checkout/cancel`,
    automatic_tax: { enabled: ctx.automaticTax },
    custom_text: customText,
    ...(ctx.requireTermsConsent ? { consent_collection: { terms_of_service: 'required' } } : {}),
    ...(ctx.email ? { customer_email: ctx.email } : {}),
  };

  if (input.kind === 'pack') {
    return {
      ...common,
      mode: 'payment',
      line_items: [{ price: ctx.packPriceId, quantity: 1 }],
      metadata: { kind: 'pack', packId: input.packId },
    };
  }
  if (input.kind === 'plugin') {
    if (input.product === PRICING.product) return aiEditorParams(input, ctx, common);
    return {
      ...common,
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
      metadata: { kind: 'plugin', product: input.product },
      subscription_data: {
        metadata: { kind: 'plugin', product: input.product },
      },
    };
  }
  return {
    ...common,
    mode: 'subscription',
    line_items: [{ price: ctx.membershipPriceId, quantity: 1 }],
    metadata: { kind: 'membership', plan: input.plan },
  };
}

/**
 * The AI Editor Pro sessions. The route has validated the combination: either `lifetime`, or a `tier`
 * (and `trial` only on PRICING.trial.tier). Tier is stored on the licence from the metadata.
 */
function aiEditorParams(
  input: Extract<CheckoutInput, { kind: 'plugin' }>,
  ctx: CheckoutContext,
  common: Stripe.Checkout.SessionCreateParams,
): Stripe.Checkout.SessionCreateParams {
  if (input.lifetime) {
    // Lifetime takes the founding coupon like any tier (the route has checked the founding cap) and counts as a founding sale.
    const founding = ctx.founding === true && !!ctx.foundingCouponId;
    const metadata = { kind: 'plugin', product: input.product, tier: PRICING.lifetime.tier, founding: founding ? '1' : '0', lifetime: '1', trial: '0' };
    return {
      ...common,
      mode: 'payment',
      customer_creation: 'always',
      // Lifetime is capped: its only discount is the fixed founding coupon, never a customer promotion code (a fully
      // discounted session would complete without a payment and never be fulfilled). A short expiry keeps unpaid
      // sessions from piling up past the cap.
      ...(founding ? { discounts: [{ coupon: ctx.foundingCouponId as string }] } : {}),
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
      metadata,
    };
  }

  const tier = input.tier ?? '';
  const trial = input.trial === true && tier === PRICING.trial.tier;
  // A trial never takes the founding coupon: a no-card trial must not use up one of the limited redemptions.
  const founding = !trial && ctx.founding === true && !!ctx.foundingCouponId;
  const metadata = {
    kind: 'plugin', product: input.product, tier,
    founding: founding ? '1' : '0', lifetime: '0', trial: trial ? '1' : '0',
  };

  return {
    ...common,
    mode: 'subscription',
    // Stripe rejects discounts together with allow_promotion_codes.
    ...(founding ? { discounts: [{ coupon: ctx.foundingCouponId as string }] } : { allow_promotion_codes: true }),
    ...(trial && !PRICING.trial.requireCard ? { payment_method_collection: 'if_required' as const } : {}),
    line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      ...(trial
        ? {
            trial_period_days: PRICING.trial.days,
            ...(PRICING.trial.requireCard ? {} : { trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } }),
          }
        : {}),
    },
  };
}
