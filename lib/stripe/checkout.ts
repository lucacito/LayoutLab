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
    return {
      ...common,
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
      metadata: { kind: 'plugin', product: input.product },
      subscription_data: { metadata: { kind: 'plugin', product: input.product } },
    };
  }
  return {
    ...common,
    mode: 'subscription',
    line_items: [{ price: ctx.membershipPriceId, quantity: 1 }],
    metadata: { kind: 'membership', plan: input.plan },
  };
}
