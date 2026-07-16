// One-time: create the two Pro plugin Products + yearly Prices in Stripe and
// print the env lines to paste into .env / Vercel. Idempotent by lookup on
// product metadata.slug. Run with: npx tsx scripts/stripe-plugin-products.ts
//
// Lookup uses stripe.products.list (strongly consistent) with a client-side
// filter on metadata.slug, NOT stripe.products.search — the Search API is
// eventually consistent (newly created objects can be unsearchable for up to
// ~1 minute), which caused duplicate products/prices when this script was
// re-run shortly after a prior run.
import Stripe from 'stripe';

const PRODUCTS = [
  { slug: 'elementor-to-divi5-pro', name: 'JHMG Converter For Elementor to Divi 5 — Pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO', yearlyUsdCents: 4900 },
  { slug: 'divi-to-elementor-pro', name: 'JHMG Converter For Divi to Elementor — Pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO', yearlyUsdCents: 4900 },
  { slug: 'ai-editor-divi5-pro', name: 'AI Editor for Divi 5 — Pro', envVar: 'STRIPE_PRICE_AI_EDITOR_PRO', yearlyUsdCents: 3900 },
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

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const stripe = new Stripe(secret);
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
