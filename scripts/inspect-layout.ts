// Print a layout's asset refs (blob JSON + desktop screenshot) by slug, so a fix
// can fetch + diagnose it. Usage: bash scripts/inspect-layout.sh <slug-or-fragment>
import { like } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { layouts } from '@/db/schema';

// TARGET_DB_URL lets us point at prod (Neon unpooled) or local; falls back to local.
const connectionString = process.env.TARGET_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const db = drizzle(new Pool({ connectionString }), { schema });

async function main() {
  const frag = process.argv[2];
  if (!frag) { console.error('usage: inspect-layout.ts <slug-or-fragment>'); process.exit(1); }
  const rows = await db
    .select({ slug: layouts.slug, title: layouts.title, type: layouts.type, status: layouts.status,
      json: layouts.diviJsonBlobKey, previews: layouts.previewImageKeys })
    .from(layouts)
    .where(like(layouts.slug, `%${frag}%`))
    .limit(10);
  if (!rows.length) { console.error(`no layout matching: ${frag}`); process.exit(1); }
  for (const r of rows) {
    console.log(JSON.stringify({
      slug: r.slug, title: r.title, type: r.type, status: r.status,
      json: r.json,
      desktop: (r.previews ?? []).find((k) => k.includes('desktop')) ?? (r.previews ?? [])[0] ?? null,
    }));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
