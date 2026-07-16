// One-time: reprice the AI Editor for Divi 5 — Pro from $79/yr to $39/yr.
//
// Archives the current active yearly price (whatever it is, if != $39) and mints
// a fresh $39/yr recurring price, then prints the env line to paste into Vercel
// prod + .env.prod. Idempotent: if an active $39/yr price already exists it is
// reused and nothing is archived.
//
// Existing subscribers are UNAFFECTED — archiving a price never changes the price
// on subscriptions that already reference it; it only stops new checkouts from
// using it. New checkouts pick up the new price via STRIPE_PRICE_AI_EDITOR_PRO.
//
// Run against LIVE:  set -a && source .env.prod && set +a && npx tsx scripts/reprice-ai-editor.ts
import Stripe from 'stripe';

const SLUG = 'ai-editor-divi5-pro';
const NEW_CENTS = 3900;

async function findBySlug(stripe: Stripe, slug: string): Promise<Stripe.Product | undefined> {
  const matches: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    if (product.metadata?.slug === slug) matches.push(product);
  }
  matches.sort((a, b) => a.created - b.created);
  return matches[0];
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  const stripe = new Stripe(secret);

  const product = await findBySlug(stripe, SLUG);
  if (!product) { console.error(`No product found for slug "${SLUG}"`); process.exit(1); }
  console.error(`[${mode}] product ${product.id} (${product.name})`);

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const yearly = prices.data.filter((p) => p.recurring?.interval === 'year');

  const alreadyNew = yearly.find((p) => p.unit_amount === NEW_CENTS);
  if (alreadyNew) {
    console.error(`Active $${NEW_CENTS / 100}/yr price already exists — reusing, nothing archived.`);
    console.log(`STRIPE_PRICE_AI_EDITOR_PRO=${alreadyNew.id}`);
    return;
  }

  // Archive every active yearly price that isn't already the new amount.
  for (const p of yearly) {
    await stripe.prices.update(p.id, { active: false });
    console.error(`archived old price ${p.id} ($${(p.unit_amount ?? 0) / 100}/yr)`);
  }

  const created = await stripe.prices.create({
    product: product.id, currency: 'usd', unit_amount: NEW_CENTS,
    recurring: { interval: 'year' },
  });
  console.error(`minted new price ${created.id} ($${NEW_CENTS / 100}/yr)`);
  console.log(`STRIPE_PRICE_AI_EDITOR_PRO=${created.id}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
