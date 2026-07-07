// Copy an edited layout's asset refs from the LOCAL row to the PROD (Neon) row by
// slug — the way a fix to an already-published layout reaches the live site (ingest
// can't update). Reads the 4 fields from local `db`, writes them to prod via a
// direct pg Pool. Local + prod share the blob store, so the new-key assets are
// already reachable; this just repoints the prod row.
//
// Usage: bash scripts/push-fix-to-prod.sh <slug>
//   env: local .env.local (for local db) + PROD_DATABASE_URL (Neon direct/unpooled)
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import * as schema from '@/db/schema';

async function main() {
  const slug = process.argv[2];
  const prodUrl = process.env.PROD_DATABASE_URL;
  if (!slug) { console.error('usage: apply-prod-refs.ts <slug>'); process.exit(1); }
  if (!prodUrl) { console.error('PROD_DATABASE_URL not set'); process.exit(1); }

  const [row] = await db
    .select({
      diviJsonBlobKey: layouts.diviJsonBlobKey,
      previewImageKeys: layouts.previewImageKeys,
      contentHash: layouts.contentHash,
      perceptualHash: layouts.perceptualHash,
      status: layouts.status,
    })
    .from(layouts)
    .where(eq(layouts.slug, slug))
    .limit(1);
  if (!row) { console.error(`local layout not found: ${slug}`); process.exit(1); }
  console.log(`[prod] local refs for ${slug}: hash=${row.contentHash.slice(0, 12)} status=${row.status}`);

  const pool = new Pool({ connectionString: prodUrl });
  const pdb = drizzle(pool, { schema });
  try {
    const before = await pdb.select({ id: layouts.id, hash: layouts.contentHash, status: layouts.status })
      .from(layouts).where(eq(layouts.slug, slug)).limit(1);
    if (!before[0]) { console.error(`PROD layout not found for slug ${slug} — nothing to update`); process.exit(1); }
    console.log(`[prod] before: id=${before[0].id} hash=${before[0].hash.slice(0, 12)} status=${before[0].status}`);

    const upd = await pdb.update(layouts)
      .set({
        diviJsonBlobKey: row.diviJsonBlobKey,
        previewImageKeys: row.previewImageKeys,
        contentHash: row.contentHash,
        perceptualHash: row.perceptualHash,
      })
      .where(eq(layouts.slug, slug))
      .returning({ id: layouts.id, hash: layouts.contentHash });
    console.log(`[prod] updated ${upd.length} row → hash=${upd[0]?.hash.slice(0, 12)} (status unchanged, stays live)`);
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
