import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { packs } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';
import { buildCheckoutSessionParams, type CheckoutInput, type CheckoutContext } from '@/lib/stripe/checkout';

const bodySchema = z.union([
  z.object({ kind: z.literal('pack'), packId: z.string().min(1) }),
  z.object({ kind: z.literal('membership'), plan: z.enum(['monthly', 'yearly']) }),
]);

// TODO(§16): add rate limiting to this route.
export async function POST(req: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const input = parsed.data as CheckoutInput;

  let packPriceId: string | undefined;
  let membershipPriceId: string | undefined;
  if (input.kind === 'pack') {
    const rows = await db
      .select({ priceId: packs.stripePriceId, status: packs.status, kind: packs.kind })
      .from(packs).where(eq(packs.id, input.packId)).limit(1);
    const pack = rows[0];
    if (!pack || pack.status !== 'published' || pack.kind !== 'paid' || !pack.priceId) {
      return NextResponse.json({ error: 'pack_unavailable' }, { status: 400 });
    }
    packPriceId = pack.priceId;
  } else {
    membershipPriceId = input.plan === 'yearly'
      ? env.STRIPE_PRICE_MEMBERSHIP_YEARLY
      : env.STRIPE_PRICE_MEMBERSHIP_MONTHLY;
    if (!membershipPriceId) return NextResponse.json({ error: 'membership_unavailable' }, { status: 400 });
  }

  const requireTermsConsent = env.STRIPE_TERMS_CONSENT === '1' || env.STRIPE_TERMS_CONSENT === 'true';
  const makeCtx = (automaticTax: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL, packPriceId, membershipPriceId, automaticTax, requireTermsConsent,
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
