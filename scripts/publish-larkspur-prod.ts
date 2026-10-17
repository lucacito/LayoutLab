// Publish the Larkspur real estate pack to PROD, straight to the production database.
//
// Used when the production INGEST_API_TOKEN is not available (it is a hidden Vercel secret).
// It does exactly what POST /api/ingest does (app/api/ingest/route.ts) and then what the pack
// assembly does: copies the 7 layout rows + their tags from the LOCAL database (already
// validated; their JSON and screenshots are in the Blob store local and prod share), and
// upserts the FREE pack. Idempotent (content-hash dedupe), no Stripe, nothing is deleted.
//
// Usage: bash scripts/publish-larkspur-prod.sh            (dry run: reads both DBs, writes nothing)
//        bash scripts/publish-larkspur-prod.sh --confirm  (writes prod)
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { packs, packLayouts, layouts, tags, layoutTags } from '@/db/schema';

const CONFIRM = process.argv.includes('--confirm');

const PACK_SLUG = 'larkspur-real-estate-theme';
const PACK_TITLE = 'Larkspur — Fresh Real Estate Theme (7 Pages)';
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
    'real estate site in an afternoon. Free download.',
  keywords: [
    'divi 5 real estate theme', 'real estate website template', 'divi real estate pack',
    'realtor website template', 'divi 5 multi-page theme', 'real estate agent website divi',
  ],
};
// Ordered pack pages (home first: its cover becomes the pack cover).
const SLUGS = ['home', 'listings', 'property', 'sell', 'neighborhoods', 'about', 'contact'].map(
  (r) => `larkspur-home-co-minimal-real-estate-${r}-page-for-divi-5`,
);

async function main() {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const localUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!prodUrl || prodUrl.length < 30 || prodUrl.includes('SENSITIVE')) throw new Error('PROD_DATABASE_URL is not a real connection string (a placeholder from a Vercel pull?)');
  if (!localUrl || !/localhost|127\.0\.0\.1/.test(localUrl)) throw new Error('local POSTGRES_URL must point at the local dev database');
  console.log(`[publish] target=PROD (free pack, no Stripe)  confirm=${CONFIRM}`);

  const localPool = new Pool({ connectionString: localUrl });
  const prodPool = new Pool({ connectionString: prodUrl });
  const local = drizzle(localPool, { schema });
  const prod = drizzle(prodPool, { schema });
  try {
    const rows = await local.select().from(layouts).where(inArray(layouts.slug, SLUGS));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const s of SLUGS) console.log(`   local ${bySlug.has(s) ? 'ok     ' : 'MISSING'} ${s}`);
    if (rows.length !== SLUGS.length) throw new Error('not all 7 pages are in the local database, aborting');
    for (const r of rows) {
      if (r.validatorPassed !== true) throw new Error(`${r.slug} was not validated, aborting`);
      if (!/^https:\/\//.test(r.diviJsonBlobKey) || !(r.previewImageKeys ?? []).every((k) => /^https:\/\//.test(k)))
        throw new Error(`${r.slug} has local-only assets (not in Blob), aborting`);
    }

    // What is already on prod (by slug).
    const onProd = await prod.select({ id: layouts.id, slug: layouts.slug, hash: layouts.contentHash }).from(layouts).where(inArray(layouts.slug, SLUGS));
    const prodBySlug = new Map(onProd.map((r) => [r.slug, r]));
    for (const s of SLUGS) {
      const p = prodBySlug.get(s);
      if (p && p.hash !== bySlug.get(s)!.contentHash) throw new Error(`${s} exists on prod with different content, aborting (resolve by hand)`);
      console.log(`   prod  ${p ? 'exists ' : 'will add'} ${s}`);
    }
    const existingPack = (await prod.select().from(packs).where(eq(packs.slug, PACK_SLUG)).limit(1))[0];
    console.log(`[publish] pack on prod: ${existingPack ? existingPack.id : 'none (will create)'}`);

    if (!CONFIRM) {
      console.log('\n[publish] DRY-RUN: nothing written. Re-run with --confirm.');
      return;
    }

    // 1) Layout rows + tags, exactly like /api/ingest (published immediately, idempotent).
    const idBySlug = new Map<string, string>();
    for (const s of SLUGS) {
      const r = bySlug.get(s)!;
      const have = prodBySlug.get(s);
      if (have) { idBySlug.set(s, have.id); continue; }
      const id = randomUUID();
      await prod.insert(layouts).values({
        id, slug: r.slug, title: r.title, description: r.description, type: r.type, niche: r.niche, style: r.style,
        colors: r.colors, diviJsonBlobKey: r.diviJsonBlobKey, previewImageKeys: r.previewImageKeys,
        contentHash: r.contentHash, perceptualHash: r.perceptualHash, variant: r.variant, validatorPassed: true,
        seo: r.seo, status: 'published', publishedAt: new Date(),
      }).onConflictDoNothing();
      idBySlug.set(s, id);
      const tagRows = await local
        .select({ axis: tags.axis, slug: tags.slug })
        .from(layoutTags).innerJoin(tags, eq(layoutTags.tagId, tags.id)).where(eq(layoutTags.layoutId, r.id));
      for (const t of tagRows) {
        const tagId = `tag_${t.axis}_${t.slug}`;
        await prod.insert(tags).values({ id: tagId, axis: t.axis, slug: t.slug, title: t.slug }).onConflictDoNothing();
        await prod.insert(layoutTags).values({ layoutId: id, tagId }).onConflictDoNothing();
      }
      console.log(`[publish] added ${s} (${tagRows.length} tags)`);
    }

    // 2) The free pack (home page's first preview becomes the cover).
    const cover = bySlug.get(SLUGS[0])!.previewImageKeys?.[0] ?? null;
    const common = {
      title: PACK_TITLE, description: DESCRIPTION, kind: 'free' as const,
      priceCents: 0, stripePriceId: null, coverImageKey: cover, seo: PACK_SEO, status: 'published' as const,
    };
    let packId: string;
    if (existingPack) {
      packId = existingPack.id;
      await prod.update(packs).set(common).where(eq(packs.id, packId));
    } else {
      packId = randomUUID();
      await prod.insert(packs).values({ id: packId, slug: PACK_SLUG, ...common });
    }
    await prod.delete(packLayouts).where(eq(packLayouts.packId, packId));
    await prod.insert(packLayouts).values(SLUGS.map((s, i) => ({ packId, layoutId: idBySlug.get(s)!, position: i })));
    console.log(`\n[publish] DONE -> https://divi5lab.com/packs/${PACK_SLUG}  (free, ${SLUGS.length} pages)`);
  } finally {
    await localPool.end();
    await prodPool.end();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
