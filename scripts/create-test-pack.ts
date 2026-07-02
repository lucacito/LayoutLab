// Create (or update) a small paid pack that contains ONE existing layout, and
// give it a Stripe price — for validating the checkout flow. Targets whatever
// database POSTGRES_URL/DATABASE_URL points at, and whatever Stripe account
// STRIPE_SECRET_KEY points at. Idempotent (upsert by pack slug).
//
// Local:
//   set -a && . ./.env.local && set +a
//   npm run test-pack
// Production (point at the prod DB + prod Stripe):
//   set -a && . ./.env.local && set +a
//   POSTGRES_URL="<prod postgres url>" STRIPE_SECRET_KEY="<prod stripe key>" \
//   TEST_PACK_LAYOUT_SLUG="<the layout slug on that DB>" npm run test-pack
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, packLayouts, layouts } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';

const LAYOUT_SLUG = process.env.TEST_PACK_LAYOUT_SLUG ?? 'elegant-coaching-landing-page-template-for-divi-5-dark-glassmorphism';
const PACK_SLUG = process.env.TEST_PACK_SLUG ?? 'test-coaching-landing';
const PACK_TITLE = process.env.TEST_PACK_TITLE ?? 'Test — Elegant Coaching Landing';
// Stripe's minimum charge is 50¢ USD — a lower amount is rejected at checkout.
const PRICE_CENTS = Number(process.env.TEST_PACK_PRICE_CENTS ?? '50');

async function main() {
  const [layout] = await db.select({ id: layouts.id, title: layouts.title }).from(layouts).where(eq(layouts.slug, LAYOUT_SLUG)).limit(1);
  if (!layout) {
    console.error(`layout not found in the target DB by slug: ${LAYOUT_SLUG}`);
    process.exitCode = 1;
    return;
  }

  // Upsert the pack.
  const existing = (await db.select().from(packs).where(eq(packs.slug, PACK_SLUG)).limit(1))[0];
  let packId: string;
  let stripePriceId: string | null;
  if (existing) {
    packId = existing.id;
    // If the price changed, force a fresh Stripe price (Stripe prices are immutable).
    const priceChanged = existing.priceCents !== PRICE_CENTS;
    stripePriceId = priceChanged ? null : existing.stripePriceId;
    await db.update(packs).set({ kind: 'paid', priceCents: PRICE_CENTS, status: 'published', ...(priceChanged ? { stripePriceId: null } : {}) }).where(eq(packs.id, packId));
  } else {
    packId = randomUUID();
    stripePriceId = null;
    await db.insert(packs).values({
      id: packId, slug: PACK_SLUG, title: PACK_TITLE,
      description: `A ${(PRICE_CENTS / 100).toFixed(2)} USD test pack for validating checkout.`,
      kind: 'paid', priceCents: PRICE_CENTS, status: 'published',
    });
  }

  await db.insert(packLayouts).values({ packId, layoutId: layout.id, position: 0 }).onConflictDoNothing();

  // Ensure a Stripe price exists (in the Stripe account STRIPE_SECRET_KEY points at).
  if (!stripePriceId) {
    const product = await stripe.products.create({ name: PACK_TITLE, metadata: { packSlug: PACK_SLUG } });
    const price = await stripe.prices.create({ product: product.id, unit_amount: PRICE_CENTS, currency: 'usd' });
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, packId));
    stripePriceId = price.id;
    console.log(`created Stripe price ${price.id}`);
  } else {
    console.log(`pack already has Stripe price ${stripePriceId}`);
  }

  console.log(`\nPack ready: /packs/${PACK_SLUG}  (${PRICE_CENTS}¢, contains "${layout.title}")`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
