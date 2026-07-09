// Backfill: (re)generate taxonomy landing copy so every axis value gets the
// long-form `body` (rows with a body already are skipped — see seo-copy.ts).
// Works against local db by default, prod via TARGET_DB_URL (shell wrapper).
//
// Usage: bash scripts/backfill-taxonomy-body.sh [prod] [--confirm]
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { taxonomyPages } from '@/db/schema';
import * as schema from '@/db/schema';
import { generateTaxonomyCopy } from '@/pipeline/seo-copy';
import { claudeCliClient } from '@/pipeline/llm';
import type { TaxonomyAxis, TaxonomyCopy } from '@/lib/seo/taxonomy';

const confirm = process.argv.includes('--confirm');

async function main() {
  const targetUrl = process.env.TARGET_DB_URL;
  const pool = targetUrl ? new Pool({ connectionString: targetUrl }) : null;
  const db = pool ? drizzle(pool, { schema }) : (await import('@/db/client')).db;
  console.log(`${confirm ? 'CONFIRM (generating + writing rows)' : 'DRY-RUN (no writes)'} — db: ${targetUrl ? 'TARGET_DB_URL (prod)' : 'local'}`);

  // db-bound copies of getTaxonomyCopy/upsertTaxonomyCopy (lib/seo/taxonomy is
  // hardwired to the app's local client; this script must also reach prod).
  const getCopy = async (axis: TaxonomyAxis, value: string): Promise<TaxonomyCopy | null> => {
    const rows = await db
      .select({ intro: taxonomyPages.intro, body: taxonomyPages.body, metaTitle: taxonomyPages.metaTitle, metaDescription: taxonomyPages.metaDescription })
      .from(taxonomyPages)
      .where(and(eq(taxonomyPages.axis, axis), eq(taxonomyPages.value, value)))
      .limit(1);
    return rows[0] ?? null;
  };
  const upsert = async (axis: TaxonomyAxis, value: string, copy: TaxonomyCopy): Promise<void> => {
    if (!confirm) {
      console.log(`would upsert ${axis}/${value} (body ${copy.body?.length ?? 0} chars)`);
      return;
    }
    await db
      .insert(taxonomyPages)
      .values({ axis, value, ...copy })
      .onConflictDoUpdate({
        target: [taxonomyPages.axis, taxonomyPages.value],
        set: { intro: copy.intro, body: copy.body ?? null, metaTitle: copy.metaTitle, metaDescription: copy.metaDescription, updatedAt: new Date() },
      });
  };

  try {
    if (!confirm) {
      // Dry-run: just report which values lack a body — no LLM calls.
      const { AXIS_VALUES } = await import('@/lib/catalog/filters');
      let missing = 0;
      for (const axis of ['type', 'niche', 'style', 'color'] as const) {
        for (const value of AXIS_VALUES[axis]) {
          const existing = await getCopy(axis, value);
          if (!existing?.body) {
            console.log(`needs body: ${axis}/${value}${existing ? ' (has intro)' : ' (no row)'}`);
            missing++;
          }
        }
      }
      console.log(`dry-run done — ${missing} value(s) need a body`);
      return;
    }
    const r = await generateTaxonomyCopy({
      llm: claudeCliClient({ model: process.env.PIPELINE_MODEL }),
      getCopy,
      upsert,
      log: (m) => console.log(m),
    });
    console.log(`done — generated ${r.generated}, skipped ${r.skipped}, failed ${r.failed}`);
    if (r.failed > 0) process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
