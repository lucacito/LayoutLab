import type Stripe from 'stripe';

export type CheckoutInput =
  | { kind: 'pack'; packId: string }
  | { kind: 'membership'; plan: 'monthly' | 'yearly' };

export interface CheckoutContext {
  siteUrl: string;
  packPriceId?: string;
  membershipPriceId?: string;
  email?: string;
  automaticTax: boolean;
}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Stripe.Checkout.SessionCreateParams {
  const common: Stripe.Checkout.SessionCreateParams = {
    success_url: `${ctx.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ctx.siteUrl}/checkout/cancel`,
    automatic_tax: { enabled: ctx.automaticTax },
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
  return {
    ...common,
    mode: 'subscription',
    line_items: [{ price: ctx.membershipPriceId, quantity: 1 }],
    metadata: { kind: 'membership', plan: input.plan },
  };
}
