import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/fulfillment';
import { dbStore } from '@/lib/stripe/fulfillment-store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });

  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event, dbStore);
  } catch (err) {
    console.error('[stripe webhook] fulfillment error', err);
    return NextResponse.json({ error: 'fulfillment_failed' }, { status: 500 }); // Stripe retries
  }

  return NextResponse.json({ received: true });
}
