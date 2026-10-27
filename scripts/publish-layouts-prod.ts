// Publish a free layout batch to PROD, straight to the production database (no ingest token needed).
// Copies the hero layout rows + their tags from the LOCAL database (already validated; JSON and screenshots are in the
// Blob store local and prod share), published immediately like /api/ingest. Idempotent, nothing is deleted.
//
// Usage: bash scripts/publish-layouts-prod.sh            (dry run: reads both DBs, writes nothing)
//        bash scripts/publish-layouts-prod.sh --confirm  (writes prod)
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { layouts, tags, layoutTags } from '@/db/schema';

const CONFIRM = process.argv.includes('--confirm');
const SLUGS = (JSON.parse(readFileSync(process.env.HERO_META ?? (() => { throw new Error('set HERO_META to the batch meta.json'); })(), 'utf8')) as { slug: string }[]).map((h) => h.slug);

async function main() {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const localUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!prodUrl || prodUrl.length < 30 || prodUrl.includes('SENSITIVE')) throw new Error('PROD_DATABASE_URL is not a real connection string (a placeholder from a Vercel pull?)');
  if (!localUrl || !/localhost|127\.0\.0\.1/.test(localUrl)) throw new Error('local POSTGRES_URL must point at the local dev database');
  console.log(`[publish] target=PROD (free layouts)  confirm=${CONFIRM}`);

  const localPool = new Pool({ connectionString: localUrl });
  const prodPool = new Pool({ connectionString: prodUrl });
  const local = drizzle(localPool, { schema });
  const prod = drizzle(prodPool, { schema });
  try {
    const rows = await local.select().from(layouts).where(inArray(layouts.slug, SLUGS));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const s of SLUGS) console.log(`   local ${bySlug.has(s) ? 'ok     ' : 'MISSING'} ${s}`);
    if (rows.length !== SLUGS.length) throw new Error(`only ${rows.length}/${SLUGS.length} layouts are in the local database, aborting`);
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

    console.log(`\n[publish] DONE: ${SLUGS.length} free layouts live on https://divi5lab.com/browse`);
  } finally {
    await localPool.end();
    await prodPool.end();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
