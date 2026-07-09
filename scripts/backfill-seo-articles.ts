// Backfill: generate long-form SEO articles (overview/features/FAQ + SERP-tuned
// metaTitle/metaDescription) for published layouts that don't have one yet, and
// merge them into layouts.seo. Grounded in each layout's real Divi JSON (blob).
//
// Dry-run by default (generates NOTHING, just lists targets). With --confirm it
// calls Claude per layout and writes rows. Idempotent: rows with seo.article are
// skipped unless --force.
//
// Usage: bash scripts/backfill-seo-articles.sh [prod] [--confirm] [--limit=N] [--slug=x]
//   env: local .env.local db by default; TARGET_DB_URL to point at prod.
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { layouts } from '@/db/schema';
import * as schema from '@/db/schema';
import { fetchAsset } from '@/lib/blob';
import { generateLayoutArticle } from '@/pipeline/seo-article';
import { claudeCliClient } from '@/pipeline/llm';

const confirm = process.argv.includes('--confirm');
const force = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const onlySlug = slugArg ? slugArg.split('=')[1] : undefined;

// Layout JSON can be huge (full landings); the prompt only needs enough
// structure+copy for grounded writing. Truncate to keep cost/latency sane.
const MAX_JSON_CHARS = 60_000;

async function main() {
  const targetUrl = process.env.TARGET_DB_URL;
  const pool = targetUrl ? new Pool({ connectionString: targetUrl }) : null;
  const db = pool ? drizzle(pool, { schema }) : (await import('@/db/client')).db;
  console.log(`${confirm ? 'CONFIRM (generating + writing rows)' : 'DRY-RUN (no LLM calls, no writes)'} — db: ${targetUrl ? 'TARGET_DB_URL (prod)' : 'local'}`);

  const llm = claudeCliClient({ model: process.env.PIPELINE_MODEL });
  const stats = { done: 0, floorMissed: 0, failed: 0, skipped: 0 };

  try {
    // Paid-only layouts (every published pack they belong to is paid) — their
    // copy must not promise a free download.
    const paidOnlyRows = await db.execute(sql`
      SELECT l.id FROM layouts l
      WHERE EXISTS (SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
                    WHERE pl.layout_id = l.id AND p.status = 'published' AND p.kind = 'paid')
        AND NOT EXISTS (SELECT 1 FROM pack_layouts pl JOIN packs p ON p.id = pl.pack_id
                        WHERE pl.layout_id = l.id AND p.status = 'published' AND p.kind = 'free')`);
    const paidOnly = new Set((paidOnlyRows.rows as { id: string }[]).map((r) => r.id));

    const rows = await db
      .select({
        id: layouts.id, slug: layouts.slug, title: layouts.title, type: layouts.type,
        niche: layouts.niche, style: layouts.style, seo: layouts.seo, blobKey: layouts.diviJsonBlobKey,
      })
      .from(layouts)
      .where(eq(layouts.status, 'published'))
      .orderBy(layouts.slug);

    let processed = 0;
    for (const row of rows) {
      if (processed >= limit) break;
      if (onlySlug && row.slug !== onlySlug) continue;
      if (row.seo?.article && !force) { stats.skipped++; continue; }

      if (!confirm) {
        console.log(`would generate: ${row.slug} (${row.type}/${row.niche}/${row.style})${paidOnly.has(row.id) ? ' [paid]' : ''}`);
        processed++;
        continue;
      }

      try {
        const blob = await fetchAsset(row.blobKey);
        if (!blob) throw new Error(`blob missing: ${row.blobKey}`);
        const json = blob.toString('utf8').slice(0, MAX_JSON_CHARS);

        const out = await generateLayoutArticle(
          {
            title: row.title,
            type: row.type,
            niche: row.niche ?? 'saas',
            style: row.style ?? 'minimal',
            paid: paidOnly.has(row.id),
            layoutJson: json,
          },
          { llm, log: (m) => console.log(`  ${m}`) },
        );

        // Floor-missed content still beats an empty page — write it, but keep
        // the EXISTING metaTitle/metaDescription (don't replace known-good
        // meta with under-floor meta).
        const seo = {
          ...(row.seo ?? {}),
          article: out.article,
          ...(out.floorMissed
            ? {}
            : { metaTitle: out.meta.metaTitle, metaDescription: out.meta.metaDescription }),
        };
        await db.update(layouts).set({ seo }).where(eq(layouts.id, row.id));
        stats.done++;
        if (out.floorMissed) stats.floorMissed++;
        console.log(`✓ ${row.slug}${out.floorMissed ? ' (floor missed — article stored, meta kept)' : ''}${out.retried ? ' (retried)' : ''}`);
      } catch (e) {
        stats.failed++;
        console.warn(`! ${row.slug}: ${(e as Error).message}`);
      }
      processed++;
    }
  } finally {
    await pool?.end();
  }
  console.log(`done: ${JSON.stringify(stats)}`);
  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
