import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe/client';
import { buildCheckoutSessionParams, type CheckoutInput, type CheckoutContext } from '@/lib/stripe/checkout';
import { PLUGIN_PRODUCTS, type PluginProduct } from '@/lib/license-server/core';
import { PRICING } from '@/lib/pricing/config';
import { isProductPaused } from '@/lib/site/pro-status';
import { priceIdForTier, lifetimePriceId, foundingCouponId, foundingAvailable, lifetimeAvailable, tierForPriceId } from '@/lib/pricing/stripe';
import { dbStore } from '@/lib/stripe/fulfillment-store';

// Marketplace demotion (Task 6): layouts/packs are free-with-capture now, so only the
// shipped WordPress plugin is still sold through this route. `pack` and `membership`
// are deliberately absent from this union (not just unreachable branches) so any
// caller still POSTing them gets a clean 400 `invalid_request`, exactly like any
// other malformed body.
const bodySchema = z.object({
  kind: z.literal('plugin'),
  product: z.enum(PLUGIN_PRODUCTS),
  tier: z.enum(['personal', 'freelancer', 'agency']).optional(),
  lifetime: z.boolean().optional(),
  trial: z.boolean().optional(),
});

// TODO(§16): add rate limiting to this route.
export async function POST(req: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const input: Extract<CheckoutInput, { kind: 'plugin' }> = parsed.data;
  // Paused product (lib/site/pro-status.ts): refuse before any Stripe call.
  if (isProductPaused(input.product)) return NextResponse.json({ error: 'This product is not currently available.' }, { status: 410 });

  const isAiEditor = input.product === PRICING.product;
  let pluginPriceId: string | undefined;
  let foundingFlag = false;

  if (isAiEditor) {
    // Exactly one of: lifetime, or a tier (trial only on the trial tier).
    if (input.lifetime) {
      if (input.tier || input.trial) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      pluginPriceId = lifetimePriceId();
      if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });
      const sold = await dbStore.countLicensesByCondition({ lifetime: true, productSlug: PRICING.product });
      if (!lifetimeAvailable(sold)) return NextResponse.json({ error: 'sold_out' }, { status: 410 });
    } else {
      if (!input.tier || (input.trial && input.tier !== PRICING.trial.tier)) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }
      pluginPriceId = priceIdForTier(input.tier);
      if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });
      if (!input.trial && foundingCouponId()) {
        const taken = await dbStore.countLicensesByCondition({ founding: true, productSlug: PRICING.product });
        foundingFlag = foundingAvailable(taken);
      }
    }
  } else {
    if (input.tier || input.lifetime || input.trial) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    // Built per-request (not module-level) so it always reflects the live `env`
    // singleton, which keeps the next product a one-line addition.
    const PRICE_ENV: Record<PluginProduct, string | undefined> = {
      'elementor-to-divi5-pro': env.STRIPE_PRICE_ELEM2DIVI_PRO,
      'divi-to-elementor-pro': env.STRIPE_PRICE_DIVI2ELEM_PRO,
      'ai-editor-divi5-pro': undefined, // sold by tier, handled above
      'beaver-to-divi5-pro': env.STRIPE_PRICE_BB2DIVI_PRO,
      'wpbakery-to-divi5-pro': env.STRIPE_PRICE_WPB2DIVI_PRO,
      'bricks-to-divi5-pro': env.STRIPE_PRICE_BRICKS2DIVI_PRO,
    };
    pluginPriceId = PRICE_ENV[input.product];
    if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });
  }

  const requireTermsConsent = env.STRIPE_TERMS_CONSENT === '1' || env.STRIPE_TERMS_CONSENT === 'true';
  const makeCtx = (automaticTax: boolean, founding: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    pluginPriceId,
    automaticTax,
    requireTermsConsent,
    founding,
    foundingCouponId: founding ? foundingCouponId() : undefined,
  });

  const urlOr500 = (session: Stripe.Checkout.Session) => {
    if (!session.url) {
      console.error('[checkout] session has no url', session.id);
      return NextResponse.json({ error: 'session_url_missing' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  };

  const fail = (err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[checkout] session create failed', err);
    return NextResponse.json({ error: 'checkout_failed', detail }, { status: 502 });
  };

  // Two things can be retried without: a founding coupon Stripe refuses (e.g. its redemption limit is used up),
  // and automatic tax (e.g. Stripe Tax not enabled). Anything else fails cleanly.
  let tax = true;
  let founding = foundingFlag;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return urlOr500(await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(tax, founding))));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (founding && /coupon|discount|promotion/i.test(msg)) {
        console.warn('[checkout] founding coupon refused; retrying without it:', msg);
        founding = false;
        continue;
      }
      if (tax && /tax/i.test(msg)) {
        console.warn('[checkout] automatic_tax failed; retrying without tax:', msg);
        tax = false;
        continue;
      }
      return fail(err);
    }
  }
  return fail(new Error('checkout retries exhausted'));
}
