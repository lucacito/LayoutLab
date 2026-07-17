// One-time: reprice all three Pro plugins.
//   Elementor → Divi 5 Pro  $49/yr -> $25/yr
//   Divi → Elementor Pro    $49/yr -> $25/yr
//   AI Editor for Divi 5 Pro $39/yr -> $30/yr
//
// For each product it archives the current active yearly price (if it isn't
// already the target) and mints a fresh yearly price, then prints the env line
// to paste into Vercel prod + .env.prod. Idempotent: if an active price at the
// target amount already exists it is reused and nothing is archived.
//
// Existing subscribers are UNAFFECTED — archiving a price never changes the
// price on subscriptions that already reference it; it only stops new checkouts
// from using it. New checkouts pick up the new price via the printed env vars.
//
// Run against LIVE:  set -a && source .env.prod && set +a && npx tsx scripts/reprice-plugins.ts
import Stripe from 'stripe';

const TARGETS = [
  { slug: 'elementor-to-divi5-pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO', newCents: 2500 },
  { slug: 'divi-to-elementor-pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO', newCents: 2500 },
  { slug: 'ai-editor-divi5-pro', envVar: 'STRIPE_PRICE_AI_EDITOR_PRO', newCents: 3000 },
] as const;

async function findBySlug(stripe: Stripe, slug: string): Promise<Stripe.Product | undefined> {
  const matches: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    if (product.metadata?.slug === slug) matches.push(product);
  }
  matches.sort((a, b) => a.created - b.created);
  return matches[0];
}

async function reprice(stripe: Stripe, mode: string, slug: string, envVar: string, newCents: number) {
  const product = await findBySlug(stripe, slug);
  if (!product) { console.error(`No product found for slug "${slug}" — skipping`); return; }
  console.error(`[${mode}] ${slug} -> product ${product.id} (${product.name})`);

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const yearly = prices.data.filter((p) => p.recurring?.interval === 'year');

  const alreadyNew = yearly.find((p) => p.unit_amount === newCents);
  if (alreadyNew) {
    console.error(`  active $${newCents / 100}/yr price already exists — reusing, nothing archived.`);
    console.log(`${envVar}=${alreadyNew.id}`);
    return;
  }

  for (const p of yearly) {
    await stripe.prices.update(p.id, { active: false });
    console.error(`  archived old price ${p.id} ($${(p.unit_amount ?? 0) / 100}/yr)`);
  }

  const created = await stripe.prices.create({
    product: product.id, currency: 'usd', unit_amount: newCents,
    recurring: { interval: 'year' },
  });
  console.error(`  minted new price ${created.id} ($${newCents / 100}/yr)`);
  console.log(`${envVar}=${created.id}`);
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  const stripe = new Stripe(secret);

  for (const t of TARGETS) {
    await reprice(stripe, mode, t.slug, t.envVar, t.newCents);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
