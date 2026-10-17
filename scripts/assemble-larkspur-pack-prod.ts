// Assemble the Larkspur 7-page real estate pack ON PROD (Neon) with a LIVE Stripe price.
// Minimal + auditable: only the prod DB + Stripe, no render/ingest machinery.
// Mirrors upsertPack() in create-restaurant-pack.ts but targets prod directly.
//
// Usage: bash scripts/assemble-larkspur-pack-prod.sh   (dry-run prints the plan)
//        bash scripts/assemble-larkspur-pack-prod.sh --confirm
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import Stripe from 'stripe';
import * as schema from '@/db/schema';
import { packs, packLayouts, layouts } from '@/db/schema';

const CONFIRM = process.argv.includes('--confirm');

const PACK_SLUG = 'larkspur-real-estate-theme';
const PACK_TITLE = 'Larkspur — Fresh Real Estate Theme (7 Pages)';
const PRICE_CENTS = 1200; // $12
const DESCRIPTION =
  'Everything a real estate agent or small brokerage needs to launch a credible website — seven ' +
  'coherent Divi 5 pages that already share one fresh, editorial identity. Home, Listings, a ' +
  'single Property page, Sell Your Home, Neighborhoods, About and Contact, all built on one brand voice, ' +
  'one forest-green and brass palette and one consistent set of office, phone and booking details — so you ' +
  'swap in your own name, listings and photos and go live in an afternoon. This is not seven stock ' +
  'templates in a folder: it is a real real-estate website. The Home page earns trust, the Listings and ' +
  'Property pages make people want a tour, the Sell page turns an owner into a valuation request, and the ' +
  'Contact page turns a browse into a booking — every headline written like a senior copywriter wrote it, ' +
  'every section validated and checked in a real Divi render. No lorem ipsum, no broken layouts, no ' +
  '"your content here." One simple commercial license, unlimited client sites.';
const PACK_SEO = {
  metaTitle: 'Larkspur — Fresh Real Estate Theme for Divi 5 (7 Coherent Pages) | Divi5Lab',
  metaDescription:
    'A complete 7-page Divi 5 real estate website theme — Home, Listings, Property, Sell, Neighborhoods, ' +
    'About & Contact — one fresh brand, senior-level copy, real booking details. Launch a credible ' +
    'real estate site in an afternoon. $12.',
  keywords: [
    'divi 5 real estate theme', 'real estate website template', 'divi real estate pack',
    'realtor website template', 'divi 5 multi-page theme', 'real estate agent website divi',
  ],
};
// Ordered pack pages (home first — its cover becomes the pack cover).
const SLUGS = ['home', 'listings', 'property', 'sell', 'neighborhoods', 'about', 'contact'].map(
  (r) => `larkspur-home-co-minimal-real-estate-${r}-page-for-divi-5`,
);

async function main() {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!prodUrl) throw new Error('PROD_DATABASE_URL not set');
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');
  const isLive = stripeKey.startsWith('sk_live_');
  console.log(`[pack] target=PROD  stripe=${isLive ? 'LIVE' : stripeKey.slice(0, 8)}  confirm=${CONFIRM}`);

  const pool = new Pool({ connectionString: prodUrl });
  const db = drizzle(pool, { schema });
  const stripe = new Stripe(stripeKey);
  try {
    const rows = await db
      .select({ id: layouts.id, slug: layouts.slug, previews: layouts.previewImageKeys })
      .from(layouts).where(inArray(layouts.slug, SLUGS));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const found = SLUGS.filter((s) => bySlug.has(s));
    console.log(`[pack] pages on prod: ${found.length}/${SLUGS.length}`);
    for (const s of SLUGS) console.log(`   ${bySlug.has(s) ? '✓' : '✗ MISSING'} ${s}`);
    if (found.length !== SLUGS.length) throw new Error('not all 7 pages are on prod — aborting');

    const cover = bySlug.get(SLUGS[0])!.previews?.[0] ?? null;
    const existing = (await db.select().from(packs).where(eq(packs.slug, PACK_SLUG)).limit(1))[0];
    console.log(`[pack] existing pack: ${existing ? existing.id : 'none'}  cover=${cover ? 'set' : 'none'}  price=$${(PRICE_CENTS / 100).toFixed(2)}`);

    if (!CONFIRM) {
      console.log('\n[pack] DRY-RUN — would upsert pack + link 7 pages + mint a Stripe price. Re-run with --confirm.');
      return;
    }

    const common = {
      title: PACK_TITLE, description: DESCRIPTION, kind: 'paid' as const,
      priceCents: PRICE_CENTS, coverImageKey: cover, seo: PACK_SEO, status: (process.env.PACK_STATUS === 'published' ? 'published' : 'draft') as 'published' | 'draft',
    };
    let packId: string;
    let stripePriceId: string | null;
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

    await db.delete(packLayouts).where(eq(packLayouts.packId, packId));
    await db.insert(packLayouts).values(found.map((s, i) => ({ packId, layoutId: bySlug.get(s)!.id, position: i })));
    console.log(`[pack] linked ${found.length} pages to pack ${packId}`);

    if (!stripePriceId) {
      const product = await stripe.products.create({ name: PACK_TITLE, metadata: { packSlug: PACK_SLUG } });
      const price = await stripe.prices.create({ product: product.id, unit_amount: PRICE_CENTS, currency: 'usd' });
      await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, packId));
      console.log(`[pack] minted Stripe price ${price.id} (product ${product.id})`);
    } else {
      console.log(`[pack] kept existing Stripe price ${stripePriceId}`);
    }
    console.log(`\n[pack] DONE → https://divi5lab.com/packs/${PACK_SLUG}  ($${(PRICE_CENTS / 100).toFixed(2)}, ${found.length} pages)`);
  } finally {
    await pool.end();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
