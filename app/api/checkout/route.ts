import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe/client';
import { buildCheckoutSessionParams, type CheckoutInput, type CheckoutContext } from '@/lib/stripe/checkout';

// Marketplace demotion (Task 6): layouts/packs are free-with-capture now — only the
// shipped WordPress plugin is still sold through this route. `pack` and `membership`
// are deliberately absent from this union (not just unreachable branches) so any
// caller still POSTing them gets a clean 400 `invalid_request`, exactly like any
// other malformed body.
const bodySchema = z.object({
  kind: z.literal('plugin'),
  product: z.enum(['elementor-to-divi5-pro', 'divi-to-elementor-pro']),
});

// TODO(§16): add rate limiting to this route.
export async function POST(req: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const input: Extract<CheckoutInput, { kind: 'plugin' }> = parsed.data;

  const pluginPriceId = input.product === 'elementor-to-divi5-pro'
    ? env.STRIPE_PRICE_ELEM2DIVI_PRO
    : env.STRIPE_PRICE_DIVI2ELEM_PRO;
  if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });

  const requireTermsConsent = env.STRIPE_TERMS_CONSENT === '1' || env.STRIPE_TERMS_CONSENT === 'true';
  const makeCtx = (automaticTax: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL, pluginPriceId, automaticTax, requireTermsConsent,
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
    // automatic_tax failed (e.g. Stripe Tax not enabled) — retry without tax, and
    // return a clean error if THAT also fails (previously this threw → 500 crash).
    console.warn('[checkout] automatic_tax failed; retrying without tax:', msg);
    try {
      return urlOr500(await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(false))));
    } catch (err2) {
      return fail(err2);
    }
  }
}
