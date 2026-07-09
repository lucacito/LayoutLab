// Backfill: convert existing Blob-hosted PNG screenshots (layouts.previewImageKeys,
// layouts.seo.ogImageKey, packs.coverImageKey, packs.seo.ogImageKey) to optimized
// WebP (≤1600px, ~≤250KB) and repoint the DB rows. Local + prod share one Blob
// store, so blobs upload once; run per-DB to repoint each environment's rows.
//
// Dry-run by default (fetches + optimizes to report sizes, uploads/writes nothing).
// Old PNG blobs are left in place (still referenced until every DB is migrated).
//
// Usage: bash scripts/optimize-live-images.sh [prod] [--confirm]
//   env: BLOB_READ_WRITE_TOKEN (uploads) + local .env.local db, or
//        TARGET_DB_URL to point at another (prod) database.
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { uploadAsset } from '@/lib/blob';
import { isBlobPngUrl, webpKeyForBlobUrl, optimizeScreenshot } from '@/pipeline/optimize-image';
import { layouts, packs } from '@/db/schema';
import * as schema from '@/db/schema';

const confirm = process.argv.includes('--confirm');

const kb = (n: number) => `${Math.round(n / 1024)}KB`;
const stats = { converted: 0, reused: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0 };

// old URL → new URL, shared across rows (ogImageKey usually equals previewImageKeys[0],
// and local+prod rows reference the same blobs — never convert one twice).
const cache = new Map<string, string>();

async function convert(url: string): Promise<string> {
  if (!isBlobPngUrl(url)) {
    stats.skipped++;
    return url;
  }
  const cached = cache.get(url);
  if (cached) {
    stats.reused++;
    return cached;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const png = Buffer.from(await res.arrayBuffer());
    const out = await optimizeScreenshot(png);
    const key = webpKeyForBlobUrl(url);
    stats.bytesBefore += png.length;
    stats.bytesAfter += out.buffer.length;
    let newUrl = `(would upload → ${key})`;
    if (confirm) ({ url: newUrl } = await uploadAsset(key, out.buffer, 'image/webp'));
    console.log(`  ${key}  ${kb(png.length)} → ${kb(out.buffer.length)} (q${out.quality}, ${out.width}w)`);
    stats.converted++;
    // Dry-run maps the URL to itself: dedupes repeat work while leaving rows "unchanged".
    const result = confirm ? newUrl : url;
    cache.set(url, result);
    return result;
  } catch (e) {
    stats.failed++;
    console.warn(`  ! keeping ${url}: ${(e as Error).message}`);
    return url;
  }
}

type Seo = { ogImageKey?: string } & Record<string, unknown>;

async function convertSeo(seo: Seo | null): Promise<{ seo: Seo | null; changed: boolean }> {
  if (!seo?.ogImageKey) return { seo, changed: false };
  const next = await convert(seo.ogImageKey);
  return { seo: { ...seo, ogImageKey: next }, changed: next !== seo.ogImageKey };
}

async function main() {
  if (confirm && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set — cannot upload WebP blobs.');
    process.exit(1);
  }
  const targetUrl = process.env.TARGET_DB_URL;
  const pool = targetUrl ? new Pool({ connectionString: targetUrl }) : null;
  const db = pool
    ? drizzle(pool, { schema })
    : (await import('@/db/client')).db;
  console.log(`${confirm ? 'CONFIRM (uploading + updating rows)' : 'DRY-RUN (no writes)'} — db: ${targetUrl ? 'TARGET_DB_URL (prod)' : 'local'}`);

  try {
    const layoutRows = await db
      .select({ id: layouts.id, slug: layouts.slug, previewImageKeys: layouts.previewImageKeys, seo: layouts.seo })
      .from(layouts);
    for (const row of layoutRows) {
      const keys = (row.previewImageKeys as string[]) ?? [];
      if (!keys.some(isBlobPngUrl) && !isBlobPngUrl((row.seo as Seo | null)?.ogImageKey ?? '')) continue;
      console.log(`layout ${row.slug}`);
      const newKeys: string[] = [];
      for (const k of keys) newKeys.push(await convert(k));
      const { seo, changed: seoChanged } = await convertSeo(row.seo as Seo | null);
      const changed = seoChanged || newKeys.some((k, i) => k !== keys[i]);
      if (confirm && changed) {
        await db.update(layouts)
          .set({ previewImageKeys: newKeys, ...(seoChanged ? { seo: seo as typeof layouts.$inferInsert.seo } : {}) })
          .where(eq(layouts.id, row.id));
      }
    }

    const packRows = await db
      .select({ id: packs.id, slug: packs.slug, coverImageKey: packs.coverImageKey, seo: packs.seo })
      .from(packs);
    for (const row of packRows) {
      const cover = row.coverImageKey ?? '';
      if (!isBlobPngUrl(cover) && !isBlobPngUrl((row.seo as Seo | null)?.ogImageKey ?? '')) continue;
      console.log(`pack ${row.slug}`);
      const newCover = cover ? await convert(cover) : row.coverImageKey;
      const { seo, changed: seoChanged } = await convertSeo(row.seo as Seo | null);
      const changed = seoChanged || newCover !== row.coverImageKey;
      if (confirm && changed) {
        await db.update(packs)
          .set({ coverImageKey: newCover, ...(seoChanged ? { seo: seo as typeof packs.$inferInsert.seo } : {}) })
          .where(eq(packs.id, row.id));
      }
    }
  } finally {
    await pool?.end();
  }

  const saved = stats.bytesBefore - stats.bytesAfter;
  console.log(
    `\ndone: ${stats.converted} converted, ${stats.reused} reused, ${stats.skipped} skipped (non-blob-png), ${stats.failed} failed` +
    `\nsize: ${kb(stats.bytesBefore)} → ${kb(stats.bytesAfter)} (saved ${kb(saved)}${stats.bytesBefore ? `, ${Math.round((saved / stats.bytesBefore) * 100)}%` : ''})`,
  );
  process.exit(stats.failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
