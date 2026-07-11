// One-time: create the two Pro plugin Products + yearly Prices in Stripe and
// print the env lines to paste into .env / Vercel. Idempotent by lookup on
// product metadata.slug. Run with: npx tsx scripts/stripe-plugin-products.ts
import Stripe from 'stripe';

const PRODUCTS = [
  { slug: 'elementor-to-divi5-pro', name: 'JHMG Converter For Elementor to Divi 5 — Pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO' },
  { slug: 'divi-to-elementor-pro', name: 'JHMG Converter For Divi to Elementor — Pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO' },
] as const;

const YEARLY_USD_CENTS = 4900; // $49/yr — placeholder price per spec; change here before running.

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const stripe = new Stripe(secret);
  for (const p of PRODUCTS) {
    const existing = await stripe.products.search({ query: `metadata['slug']:'${p.slug}'` });
    let product = existing.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: p.name,
        metadata: { slug: p.slug },
        description: 'Annual license — unlimited sites, updates and support while active.',
      });
    }
    const prices = await stripe.prices.list({ product: product.id, active: true });
    let price = prices.data.find((x) => x.recurring?.interval === 'year');
    if (!price) {
      price = await stripe.prices.create({
        product: product.id, currency: 'usd', unit_amount: YEARLY_USD_CENTS,
        recurring: { interval: 'year' },
      });
    }
    console.log(`${p.envVar}=${price.id}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
