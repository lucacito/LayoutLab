import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/admin';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { licenses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/client';
import { PRICING } from '@/lib/pricing/config';
import { priceIdForTier } from '@/lib/pricing/stripe';

const bodySchema = z.object({
  licenseId: z.string(),
  tier: z.enum(['personal', 'freelancer', 'agency']),
});

export async function POST(req: Request): Promise<Response> {
  const session = await requireUser();
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { licenseId, tier } = parsed.data;

  // Load the license and verify ownership
  const license = await db.select().from(licenses).where(eq(licenses.id, licenseId)).limit(1);
  if (!license[0]) return NextResponse.json({ error: 'license_not_found' }, { status: 404 });

  // Verify the user owns this license (session.user.id is set by auth middleware)
  if (license[0].userId !== session.user?.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const currentLicense = license[0];

  // Verify it's an AI Editor license with a tier
  if (currentLicense.productSlug !== PRICING.product || !currentLicense.tier) {
    return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
  }

  // Refuse downgrade attempts
  const currentTierIndex = PRICING.tiers.findIndex((t) => t.id === currentLicense.tier);
  const newTierIndex = PRICING.tiers.findIndex((t) => t.id === tier);
  if (newTierIndex <= currentTierIndex) {
    return NextResponse.json({ error: 'downgrade_not_allowed' }, { status: 400 });
  }

  // Refuse upgrade on lifetime or cancelled licenses
  if (currentLicense.lifetime || currentLicense.status === 'canceled') {
    return NextResponse.json({ error: 'license_not_upgradable' }, { status: 400 });
  }

  if (!currentLicense.stripeSubscriptionId) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
  }

  try {
    const newPriceId = priceIdForTier(tier);
    if (!newPriceId) return NextResponse.json({ error: 'tier_price_not_found' }, { status: 400 });

    // Get the subscription to find the item id
    const sub = await stripe.subscriptions.retrieve(currentLicense.stripeSubscriptionId);
    if (!sub.items.data[0]) return NextResponse.json({ error: 'subscription_item_not_found' }, { status: 400 });

    // Update the subscription with proration_behavior: 'always_invoice'
    const updated = await stripe.subscriptions.update(currentLicense.stripeSubscriptionId, {
      items: [
        {
          id: sub.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
    });

    // Return success with the new tier
    return NextResponse.json({ ok: true, tier });
  } catch (err) {
    console.error('[change-tier] error:', err);
    return NextResponse.json({ error: 'upgrade_failed' }, { status: 502 });
  }
}
