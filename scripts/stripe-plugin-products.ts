// One-time: create the Pro plugin Products (the AI Editor is built from config/pricing.json: see ensureAiEditor) + yearly Prices in Stripe and
// print the env lines to paste into .env / Vercel. Idempotent by lookup on
// product metadata.slug. Run with: npx tsx scripts/stripe-plugin-products.ts
//
// Lookup uses stripe.products.list (strongly consistent) with a client-side
// filter on metadata.slug, NOT stripe.products.search — the Search API is
// eventually consistent (newly created objects can be unsearchable for up to
// ~1 minute), which caused duplicate products/prices when this script was
// re-run shortly after a prior run.
import Stripe from 'stripe';
import { PRICING } from '../lib/pricing/config';

const PRODUCTS = [
  { slug: 'elementor-to-divi5-pro', name: 'JHMG Converter For Elementor to Divi 5 — Pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO', yearlyUsdCents: 2500 },
  { slug: 'divi-to-elementor-pro', name: 'JHMG Converter For Divi to Elementor — Pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO', yearlyUsdCents: 2500 },
  { slug: 'beaver-to-divi5-pro', name: 'JHMG Converter For Beaver Builder to Divi 5 — Pro', envVar: 'STRIPE_PRICE_BB2DIVI_PRO', yearlyUsdCents: 2500 },
  { slug: 'wpbakery-to-divi5-pro', name: 'JHMG Converter For WPBakery to Divi 5 — Pro', envVar: 'STRIPE_PRICE_WPB2DIVI_PRO', yearlyUsdCents: 2500 },
  { slug: 'bricks-to-divi5-pro', name: 'JHMG Converter For Bricks to Divi 5 — Pro', envVar: 'STRIPE_PRICE_BRICKS2DIVI_PRO', yearlyUsdCents: 2500 },
] as const;

async function findBySlug(stripe: Stripe, slug: string): Promise<Stripe.Product | undefined> {
  const matches: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    if (product.metadata?.slug === slug) matches.push(product);
  }
  if (matches.length === 0) return undefined;
  // Oldest first — `created` is a unix timestamp (seconds).
  matches.sort((a, b) => a.created - b.created);
  const [oldest, ...duplicates] = matches;
  if (duplicates.length > 0) {
    console.error(
      `WARNING: found ${duplicates.length} duplicate product(s) for slug "${slug}" besides the oldest (${oldest.id}): ` +
        duplicates.map((d) => d.id).join(', ') +
        ' — please archive these manually in the Stripe dashboard.',
    );
  }
  return oldest;
}

// The AI Editor Pro: ONE product, three yearly Prices (one per tier), one one-time Lifetime Price and the
// founding-offer coupon, all taken from config/pricing.json. Idempotent: Prices are found by lookup_key, the
// coupon by its fixed id. Prints the env lines for Vercel. Nothing here is a price literal.
async function ensureAiEditor(stripe: Stripe): Promise<void> {
  let product = await findBySlug(stripe, PRICING.product);
  if (!product) {
    product = await stripe.products.create({
      name: 'AI Editor for Divi 5 — Pro',
      metadata: { slug: PRICING.product },
      description: 'Annual licence priced by site count. The price covers updates and support; the tools keep working if it lapses.',
    });
  }

  const ensurePrice = async (lookupKey: string, cents: number, recurring: boolean, envVar: string) => {
    const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];
    if (existing && existing.unit_amount !== cents) {
      console.error(`WARNING: ${lookupKey} (${existing.id}) is ${existing.unit_amount}c, config says ${cents}c. Archive it in the dashboard and re-run.`);
    }
    const price = existing ?? await stripe.prices.create({
      product: product!.id, currency: PRICING.currency.toLowerCase(), unit_amount: cents, lookup_key: lookupKey,
      ...(recurring ? { recurring: { interval: 'year' as const } } : {}),
    });
    console.log(`${envVar}=${price.id}`);
  };

  for (const tier of PRICING.tiers) await ensurePrice(`${PRICING.product}-${tier.id}`, tier.priceCents, true, tier.priceEnv);
  await ensurePrice(`${PRICING.product}-lifetime`, PRICING.lifetime.priceCents, false, PRICING.lifetime.priceEnv);

  const couponId = `${PRICING.product}-founding`;
  let coupon: Stripe.Coupon | undefined;
  try { coupon = await stripe.coupons.retrieve(couponId); } catch { coupon = undefined; }
  if (!coupon) {
    coupon = await stripe.coupons.create({
      id: couponId, name: 'Founding offer', percent_off: PRICING.founding.percentOff, duration: 'forever',
      max_redemptions: PRICING.founding.cap, applies_to: { products: [product.id] },
    });
  }
  console.log(`${PRICING.founding.couponEnv}=${coupon.id}`);
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const stripe = new Stripe(secret);
  await ensureAiEditor(stripe);
  for (const p of PRODUCTS) {
    let product = await findBySlug(stripe, p.slug);
    if (!product) {
      product = await stripe.products.create({
        name: p.name,
        metadata: { slug: p.slug },
        description: 'Annual license — unlimited sites, updates and support while active.',
      });
    }
    const prices = await stripe.prices.list({ product: product.id, active: true });
    let price = prices.data.find((x) => x.recurring?.interval === 'year');
    if (price && price.unit_amount !== p.yearlyUsdCents) {
      console.error(
        `WARNING: existing yearly price ${price.id} for ${p.slug} is ${price.unit_amount}c, expected ${p.yearlyUsdCents}c — archive it in the dashboard and re-run to mint the new price.`,
      );
    }
    if (!price) {
      price = await stripe.prices.create({
        product: product.id, currency: 'usd', unit_amount: p.yearlyUsdCents,
        recurring: { interval: 'year' },
      });
    }
    console.log(`${p.envVar}=${price.id}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
