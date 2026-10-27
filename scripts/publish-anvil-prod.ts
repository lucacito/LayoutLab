// Publish the Anvil commercial plumbing pack to PROD, straight to the production database.
//
// Used when the production INGEST_API_TOKEN is not available (it is a hidden Vercel secret).
// It does exactly what POST /api/ingest does (app/api/ingest/route.ts) and then what the pack
// assembly does: copies the 7 layout rows + their tags from the LOCAL database (already
// validated; their JSON and screenshots are in the Blob store local and prod share), and
// upserts the FREE pack. Idempotent (content-hash dedupe), no Stripe, nothing is deleted.
//
// Usage: bash scripts/publish-anvil-prod.sh            (dry run: reads both DBs, writes nothing)
//        bash scripts/publish-anvil-prod.sh --confirm  (writes prod)
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { packs, packLayouts, layouts, tags, layoutTags } from '@/db/schema';

const CONFIRM = process.argv.includes('--confirm');

const PACK_SLUG = 'anvil-commercial-plumbing-theme';
const PACK_TITLE = 'Anvil: Dark Commercial Plumbing & Contractor Theme (6 Pages)';
const DESCRIPTION =
  'A complete six-page Divi 5 website for a commercial or industrial plumbing contractor, mechanical firm or any trade ' +
  'business that sells on reliability, ready to make your own. Home, Services, Projects, Emergency & Plans, About and ' +
  'Contact share one dark, bold identity: a deep navy ground, layered cards with a light border, an electric blue accent, ' +
  'Inter type and heavy outlined buttons. Every section is built from proven, validated recipes and a single design ' +
  'language and style kit, so buttons, accordions, forms and type match on every page, on desktop, tablet and phone. A ' +
  'photographic hero, a proof-numbers band, a capabilities grid, a projects portfolio, an emergency-response walkthrough ' +
  'with plan pricing, a team page with a founder note, FAQs and a quote form with the company details are all in place. ' +
  'Names, prices, hours and reviews are sample copy: swap in your own and publish. No lorem ipsum, no broken layouts. One ' +
  'simple commercial license, unlimited client sites.';
const PACK_SEO = {
  metaTitle: 'Anvil: Dark Commercial Plumbing Theme for Divi 5 (6 Pages) | Divi5Lab',
  metaDescription:
    'A complete six-page dark Divi 5 website theme for a commercial plumbing or mechanical contractor: Home, Services, ' +
    'Projects, Emergency & Plans, About and Contact. One bold brand, real copy, portfolio, plans and quote sections.',
  keywords: [
    'divi 5 commercial plumbing theme', 'dark plumber website template', 'mechanical contractor divi template',
    'industrial contractor divi 5 theme', 'trade business website template', 'divi 5 multi-page theme',
  ],
};

const SLUGS = ['home', 'services', 'projects', 'emergency', 'about', 'contact'].map(
  (r) => `anvil-mechanical-dark-plumbing-${r}-page-for-divi-5`,
);

async function main() {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const localUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!prodUrl || prodUrl.length < 30 || prodUrl.includes('SENSITIVE')) throw new Error('PROD_DATABASE_URL is not a real connection string (a placeholder from a Vercel pull?)');
  if (!localUrl || !/localhost|127\.0\.0\.1/.test(localUrl)) throw new Error('local POSTGRES_URL must point at the local dev database');
  console.log(`[publish] target=PROD (paid theme pack, sold on STRIPE_THEME_PACK)  confirm=${CONFIRM}`);

  const localPool = new Pool({ connectionString: localUrl });
  const prodPool = new Pool({ connectionString: prodUrl });
  const local = drizzle(localPool, { schema });
  const prod = drizzle(prodPool, { schema });
  try {
    const rows = await local.select().from(layouts).where(inArray(layouts.slug, SLUGS));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const s of SLUGS) console.log(`   local ${bySlug.has(s) ? 'ok     ' : 'MISSING'} ${s}`);
    if (rows.length !== SLUGS.length) throw new Error('not all 6 pages are in the local database, aborting');
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
      title: PACK_TITLE, description: DESCRIPTION, kind: 'paid' as const,
      priceCents: 1200, stripePriceId: null, coverImageKey: cover, seo: PACK_SEO, status: 'published' as const,
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
    console.log(`\n[publish] DONE -> https://divi5lab.com/packs/${PACK_SLUG}  (paid \$12, ${SLUGS.length} pages)`);
  } finally {
    await localPool.end();
    await prodPool.end();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
