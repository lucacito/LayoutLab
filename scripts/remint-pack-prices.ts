// Re-mint a fresh Stripe price (+ product) for every published paid pack in the
// target account, and update each pack's stripe_price_id. Use after switching the
// Stripe account/key (e.g. test → live): old price IDs from the previous account
// throw "No such price", so every pack needs a price in the NEW account.
//   STRIPE_SECRET_KEY=<live> POSTGRES_URL=<prod> DATABASE_URL=<prod> npx tsx scripts/remint-pack-prices.ts
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';

async function main() {
  const rows = await db
    .select({ id: packs.id, slug: packs.slug, title: packs.title, price: packs.priceCents, old: packs.stripePriceId })
    .from(packs)
    .where(and(eq(packs.status, 'published'), eq(packs.kind, 'paid')));

  if (rows.length === 0) { console.log('no published paid packs'); return; }
  console.log(`re-minting ${rows.length} pack price(s) in the current Stripe account…\n`);

  for (const p of rows) {
    if (p.price == null || p.price <= 0) { console.warn(`skip ${p.slug}: no price_cents`); continue; }
    const product = await stripe.products.create({ name: p.title, metadata: { packSlug: p.slug } });
    const price = await stripe.prices.create({ product: product.id, unit_amount: p.price, currency: 'usd' });
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, p.id));
    console.log(`  ${p.slug}  ($${(p.price / 100).toFixed(2)})  ${p.old ?? 'NULL'} -> ${price.id}`);
  }
  console.log('\ndone.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
