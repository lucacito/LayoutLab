// Create (or update) the "Blackline Agency Theme" pack: 6 coherent Blackline Studio
// pages, one $12 price, a real Stripe price, and strong sales copy. Idempotent
// (upsert by pack slug). Targets whatever POSTGRES_URL + STRIPE_SECRET_KEY point at.
//   set -a && . ./.env.local && set +a
//   POSTGRES_URL="$DATABASE_URL(prod)" STRIPE_SECRET_KEY="<prod>" npm run tsx scripts/create-blackline-pack.ts
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, packLayouts, layouts } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';

const PACK_SLUG = 'blackline-agency-theme';
const PACK_TITLE = 'Blackline — Bold Agency Website Theme (6 Pages)';
const PRICE_CENTS = 1200; // $12

// Ordered: home first.
const SLUGS = [
  'blackline-studio-bold-agency-home-page-for-divi-5',
  'blackline-studio-bold-agency-about-page-for-divi-5',
  'blackline-studio-bold-agency-services-page-for-divi-5',
  'blackline-studio-bold-agency-case-studies-page-for-divi-5',
  'bold-agency-pricing-page-blackline-studio-divi-5-layout',
  'blackline-studio-bold-agency-contact-page-for-divi-5',
];

const DESCRIPTION =
  'Everything you need to launch a modern brand or design studio — six coherent, ' +
  'conversion-ready Divi 5 pages that already speak the same language. Home, About, ' +
  'Services, Case Studies, Pricing, and Contact, all built on one bold dark identity, ' +
  'one confident voice, and one consistent set of details — so you swap in your brand ' +
  'and go live in an afternoon, not a month. This is not six random templates in a ' +
  'folder: it is a real agency website. The Home page sells, the Services page prices ' +
  'the work, the Case Studies page proves it with named results, and the Contact page ' +
  'closes — every headline written like a senior copywriter wrote it, every section ' +
  'validated and screenshot-perfect. No lorem ipsum, no broken layouts, no "your content ' +
  'here." Just a premium, cohesive theme that makes a small studio look like the category ' +
  'leader. One simple commercial license, unlimited client sites. At $12, the easiest yes in your stack.';

const SEO = {
  metaTitle: 'Blackline — Bold Agency Website Theme for Divi 5 (6 Coherent Pages) | Divi5Lab',
  metaDescription:
    'A complete 6-page Divi 5 agency website theme — Home, About, Services, Case Studies, ' +
    'Pricing & Contact — one bold dark brand, senior-level copy, real pricing, named case ' +
    'studies. Launch a premium agency site in an afternoon. $12.',
  keywords: [
    'divi 5 agency theme', 'agency website template', 'divi agency pack',
    'creative studio website', 'divi 5 multi-page theme', 'bold dark agency template',
  ],
};

async function main() {
  const rows = await db
    .select({ id: layouts.id, slug: layouts.slug, previews: layouts.previewImageKeys })
    .from(layouts)
    .where(inArray(layouts.slug, SLUGS));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const missing = SLUGS.filter((s) => !bySlug.has(s));
  if (missing.length) {
    console.error(`missing layouts in target DB:\n${missing.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  const cover = bySlug.get(SLUGS[0])!.previews?.[0] ?? null; // home page desktop shot

  const existing = (await db.select().from(packs).where(eq(packs.slug, PACK_SLUG)).limit(1))[0];
  let packId: string;
  let stripePriceId: string | null;
  const common = {
    title: PACK_TITLE, description: DESCRIPTION, kind: 'paid' as const,
    priceCents: PRICE_CENTS, coverImageKey: cover, seo: SEO, status: 'published' as const,
  };
  if (existing) {
    packId = existing.id;
    const priceChanged = existing.priceCents !== PRICE_CENTS;
    stripePriceId = priceChanged ? null : existing.stripePriceId;
    await db.update(packs).set({ ...common, ...(priceChanged ? { stripePriceId: null } : {}) }).where(eq(packs.id, packId));
  } else {
    packId = randomUUID();
    stripePriceId = null;
    await db.insert(packs).values({ id: packId, slug: PACK_SLUG, ...common });
  }

  // (Re)link the 6 layouts in order.
  await db.delete(packLayouts).where(eq(packLayouts.packId, packId));
  await db.insert(packLayouts).values(SLUGS.map((s, i) => ({ packId, layoutId: bySlug.get(s)!.id, position: i })));

  if (!stripePriceId) {
    const product = await stripe.products.create({ name: PACK_TITLE, metadata: { packSlug: PACK_SLUG } });
    const price = await stripe.prices.create({ product: product.id, unit_amount: PRICE_CENTS, currency: 'usd' });
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, packId));
    stripePriceId = price.id;
    console.log(`created Stripe price ${price.id}`);
  } else {
    console.log(`pack already has Stripe price ${stripePriceId}`);
  }

  console.log(`\nPack ready: /packs/${PACK_SLUG}  ($${(PRICE_CENTS / 100).toFixed(2)}, ${SLUGS.length} pages, cover=${cover ? 'set' : 'none'})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
