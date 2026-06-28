import type Stripe from 'stripe';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';

export function packProductParams(pack: { slug: string; title: string; description: string | null }): Stripe.ProductCreateParams {
  return {
    name: pack.title,
    description: pack.description ?? undefined,
    metadata: { packSlug: pack.slug },
  };
}

export function packPriceParams(productId: string, priceCents: number): Stripe.PriceCreateParams {
  return { product: productId, unit_amount: priceCents, currency: 'usd' };
}

async function main() {
  const rows = await db.select().from(packs).where(and(eq(packs.kind, 'paid'), eq(packs.status, 'published')));
  for (const pack of rows) {
    if (pack.stripePriceId) { console.log(`skip ${pack.slug} (already has price)`); continue; }
    if (pack.priceCents == null) { console.log(`skip ${pack.slug} (no price_cents)`); continue; }
    const product = await stripe.products.create(packProductParams(pack));
    const price = await stripe.prices.create(packPriceParams(product.id, pack.priceCents));
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, pack.id));
    console.log(`created ${pack.slug} → ${price.id}`);
  }
  console.log('\nMembership: create monthly + yearly recurring Prices in Stripe and set');
  console.log('STRIPE_PRICE_MEMBERSHIP_MONTHLY / STRIPE_PRICE_MEMBERSHIP_YEARLY in .env.local.');
}

if (process.argv[1] && process.argv[1].endsWith('stripe-setup.ts')) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
