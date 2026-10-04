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

  // For ai-editor-divi5-pro, validate and select tier/lifetime
  let pluginPriceId: string | undefined;
  let tier: string | undefined;
  let foundingFlag = false;
  let lifetimeFlag = false;

  if (input.product === 'ai-editor-divi5-pro') {
    // Handle tier and lifetime selection for AI Editor
    if (input.lifetime) {
      // Lifetime: use one-time price
      pluginPriceId = lifetimePriceId();
      tier = 'agency';
      lifetimeFlag = true;
    } else if (input.tier) {
      // Specific tier subscription
      pluginPriceId = priceIdForTier(input.tier);
      tier = input.tier;
    } else {
      // Trial (no tier specified, no lifetime): use legacy price or undefined
      pluginPriceId = env.STRIPE_PRICE_AI_EDITOR_PRO;
      tier = undefined;
    }

    if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });

    // Check founding availability if doing a tier purchase
    if (!lifetimeFlag && tier && tier !== undefined) {
      const foundingCount = await dbStore.countLicensesByCondition({
        founding: true,
        productSlug: PRICING.product,
      });
      if (foundingAvailable(foundingCount)) {
        foundingFlag = true;
      }
    }
  } else {
    // Non-AI-Editor products: use legacy price lookup
    const PRICE_ENV: Record<PluginProduct, string | undefined> = {
      'elementor-to-divi5-pro': env.STRIPE_PRICE_ELEM2DIVI_PRO,
      'divi-to-elementor-pro': env.STRIPE_PRICE_DIVI2ELEM_PRO,
      'ai-editor-divi5-pro': env.STRIPE_PRICE_AI_EDITOR_PRO, // Handled above
      'beaver-to-divi5-pro': env.STRIPE_PRICE_BB2DIVI_PRO,
      'wpbakery-to-divi5-pro': env.STRIPE_PRICE_WPB2DIVI_PRO,
      'bricks-to-divi5-pro': env.STRIPE_PRICE_BRICKS2DIVI_PRO,
    };
    pluginPriceId = PRICE_ENV[input.product];
    if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });
  }

  const requireTermsConsent = env.STRIPE_TERMS_CONSENT === '1' || env.STRIPE_TERMS_CONSENT === 'true';
  const makeCtx = (automaticTax: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    pluginPriceId,
    automaticTax,
    requireTermsConsent,
    tier,
    founding: foundingFlag,
    lifetime: lifetimeFlag,
    foundingCouponId: foundingFlag ? foundingCouponId() : undefined,
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

  try {
    return urlOr500(await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(true))));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/tax/i.test(msg)) return fail(err);
    // automatic_tax failed (e.g. Stripe Tax not enabled), so retry without tax, and
    // return a clean error if THAT also fails (previously this threw → 500 crash).
    console.warn('[checkout] automatic_tax failed; retrying without tax:', msg);
    try {
      return urlOr500(await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(false))));
    } catch (err2) {
      return fail(err2);
    }
  }
}
