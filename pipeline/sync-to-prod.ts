// One-time backfill: push locally-generated layouts to PRODUCTION.
//
// Layouts are DB rows whose assets (JSON + screenshots) may live only on this
// machine. This reads local published layouts, uploads any local-only assets to
// (prod) Vercel Blob, and re-ingests each via the prod ingest API. Ingest is
// idempotent (content-hash dedupe), so re-running is safe.
//
// Usage (dry-run prints the plan, writes nothing):
//   set -a && . ./.env.local && set +a          # local DATABASE_URL + BLOB token
//   TARGET_INGEST_URL=https://divi5lab.com \
//   TARGET_INGEST_TOKEN=<prod ingest token> \
//   BLOB_READ_WRITE_TOKEN=<prod blob token> \
//   npm run sync-to-prod                          # dry-run
//   ... same, plus  -- --confirm                  # actually upload + ingest
//
// BLOB_READ_WRITE_TOKEN MUST be the production Blob store's token so uploaded
// assets are the ones prod serves. Seed/sample layouts (picsum previews) are
// skipped unless --include-seed is passed.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, layoutTags, tags as tagsTable } from '@/db/schema';
import { uploadAsset } from '@/lib/blob';
import { postIngest } from './ingest';
import { buildSyncPayload, isSeedLayout, needsUpload, type SyncRow, type ResolvedAssets } from './sync';

const confirm = process.argv.includes('--confirm');
const includeSeed = process.argv.includes('--include-seed');
const log = (m: string) => console.log(`[sync] ${m}`);

async function readLocalAsset(key: string): Promise<Buffer> {
  if (key.startsWith('/screenshots/')) return readFile(join('public', key));
  return readFile(key); // e.g. pipeline/out/layouts-json/<hash>.json
}

// Resolve one asset key to a prod-reachable URL: keep http(s) URLs as-is (already
// in Blob), upload local files to Blob under a stable key.
async function resolveAsset(key: string, blobKey: string, contentType: string): Promise<string> {
  if (!needsUpload(key)) return key;
  const bytes = await readLocalAsset(key);
  if (!confirm) return `(would upload → ${blobKey})`;
  const { url } = await uploadAsset(blobKey, bytes, contentType);
  return url;
}

async function main() {
  const target = { url: process.env.TARGET_INGEST_URL ?? '', token: process.env.TARGET_INGEST_TOKEN ?? '' };
  if (confirm && (!target.url || !target.token)) {
    console.error('Set TARGET_INGEST_URL and TARGET_INGEST_TOKEN to sync to production.');
    process.exitCode = 1;
    return;
  }
  log(`${confirm ? 'CONFIRM (writing to prod)' : 'DRY-RUN (no writes)'} — target: ${target.url || '(unset)'}`);

  const rows = await db.select().from(layouts).where(eq(layouts.status, 'published'));
  const summary = { total: rows.length, skippedSeed: 0, synced: 0, deduped: 0, failed: 0 };

  for (const row of rows) {
    const previews = (row.previewImageKeys as string[]) ?? [];
    if (!includeSeed && isSeedLayout(previews)) {
      summary.skippedSeed++;
      continue;
    }
    try {
      const hash = row.contentHash;
      const diviJsonBlobKey = await resolveAsset(row.diviJsonBlobKey, `layouts/${hash}.json`, 'application/json');
      const previewImageKeys: string[] = [];
      for (let i = 0; i < previews.length; i++) {
        previewImageKeys.push(await resolveAsset(previews[i]!, `layouts/${hash}-${i}.png`, 'image/png'));
      }
      const tagRows = await db
        .select({ axis: tagsTable.axis, slug: tagsTable.slug })
        .from(layoutTags)
        .innerJoin(tagsTable, eq(layoutTags.tagId, tagsTable.id))
        .where(eq(layoutTags.layoutId, row.id));

      const payload = buildSyncPayload(row as unknown as SyncRow, {
        diviJsonBlobKey,
        previewImageKeys,
        tags: tagRows as ResolvedAssets['tags'],
      });

      if (!confirm) {
        log(`would sync ${row.slug} (${previews.filter(needsUpload).length + (needsUpload(row.diviJsonBlobKey) ? 1 : 0)} local asset(s) to upload)`);
        summary.synced++;
        continue;
      }
      const res = await postIngest(payload, target);
      if (res.deduped) summary.deduped++;
      else summary.synced++;
      log(`${res.deduped ? 'exists' : 'synced'} ${row.slug}`);
    } catch (e) {
      summary.failed++;
      log(`FAILED ${row.slug}: ${(e as Error).message}`);
    }
  }
  console.log('[sync] summary:', summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
