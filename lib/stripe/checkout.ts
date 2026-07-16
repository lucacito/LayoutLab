import type Stripe from 'stripe';
import type { PluginProduct } from '@/lib/license-server/core';

export type CheckoutInput =
  | { kind: 'pack'; packId: string }
  | { kind: 'membership'; plan: 'monthly' | 'yearly' }
  | { kind: 'plugin'; product: PluginProduct };

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
   * of Service URL configured in the Dashboard when this is enabled — turning it
   * on without that URL makes session creation fail. Point that Dashboard URL at
   * `${siteUrl}/license`.
   */
  requireTermsConsent?: boolean;
}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Stripe.Checkout.SessionCreateParams {
  // Disclosed on every checkout (satisfies the "state the policy at checkout"
  // requirement, and is sufficient disclosure for US buyers).
  const submitMessage =
    `Digital goods are delivered instantly. By completing your purchase you consent to immediate delivery and agree that all sales are final and non-refundable. Full License & Refund policy: ${ctx.siteUrl}/license`;

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
    // Launch offer, scoped to the AI Editor only: a 45-day free trial with NO card
    // up front. `if_required` tells Checkout to skip payment-method collection when
    // nothing is due now (the whole trial is $0). Consequence: with no card on file
    // the trial can't auto-charge, so it ends by cancelling — a tester who wants to
    // keep the plugin must return and re-subscribe (and pay). Nobody gets a surprise
    // invoice. The webhook mints the license on `checkout.session.completed`
    // regardless of amount paid, and `trialing` maps to an active license
    // (see fulfillment.ts). Other plugins keep the standard pay-now flow.
    const aiEditorLaunchTrial = input.product === 'ai-editor-divi5-pro';
    return {
      ...common,
      mode: 'subscription',
      allow_promotion_codes: true,
      ...(aiEditorLaunchTrial ? { payment_method_collection: 'if_required' } : {}),
      line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
      metadata: { kind: 'plugin', product: input.product },
      subscription_data: {
        metadata: { kind: 'plugin', product: input.product },
        ...(aiEditorLaunchTrial
          ? {
              trial_period_days: 45,
              trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
            }
          : {}),
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
