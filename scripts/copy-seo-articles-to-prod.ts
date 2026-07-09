// Copy already-generated layouts.seo articles (+ upgraded metaTitle/metaDescription)
// from the LOCAL db to PROD rows with the same slug, so the prod backfill only has
// to LLM-generate articles for prod-only layouts. Idempotent: prod rows that
// already have an article are skipped.
//
// Usage: bash scripts/copy-seo-articles-to-prod.sh [--confirm]
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { layouts } from '@/db/schema';
import * as schema from '@/db/schema';

const confirm = process.argv.includes('--confirm');

async function main() {
  const targetUrl = process.env.TARGET_DB_URL;
  if (!targetUrl) throw new Error('TARGET_DB_URL (prod) is required — run via copy-seo-articles-to-prod.sh');
  const prodPool = new Pool({ connectionString: targetUrl });
  const prod = drizzle(prodPool, { schema });
  const local = (await import('@/db/client')).db;
  console.log(`${confirm ? 'CONFIRM (writing prod rows)' : 'DRY-RUN (no writes)'}`);

  const stats = { copied: 0, skippedHasArticle: 0, noLocalMatch: 0 };
  try {
    const localRows = await local
      .select({ slug: layouts.slug, seo: layouts.seo })
      .from(layouts)
      .where(sql`${layouts.seo}->'article' IS NOT NULL`);
    const bySlug = new Map(localRows.map((r) => [r.slug, r.seo!]));
    console.log(`local rows with articles: ${bySlug.size}`);

    const prodRows = await prod
      .select({ id: layouts.id, slug: layouts.slug, seo: layouts.seo })
      .from(layouts)
      .where(eq(layouts.status, 'published'));

    for (const row of prodRows) {
      if (row.seo?.article) { stats.skippedHasArticle++; continue; }
      const localSeo = bySlug.get(row.slug);
      if (!localSeo?.article) { stats.noLocalMatch++; continue; }
      const seo = {
        ...(row.seo ?? {}),
        article: localSeo.article,
        ...(localSeo.metaTitle ? { metaTitle: localSeo.metaTitle } : {}),
        ...(localSeo.metaDescription ? { metaDescription: localSeo.metaDescription } : {}),
      };
      if (confirm) await prod.update(layouts).set({ seo }).where(eq(layouts.id, row.id));
      console.log(`${confirm ? '✓' : 'would copy'} ${row.slug}`);
      stats.copied++;
    }
  } finally {
    await prodPool.end();
  }
  console.log(`done: ${JSON.stringify(stats)} — remaining prod rows without articles need the LLM backfill (backfill-seo-articles.sh prod --confirm)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
