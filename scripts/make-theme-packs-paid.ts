// Make every theme pack a paid pack at the one theme pack price ($12.00, sold on STRIPE_THEME_PACK).
// Section collections such as premium-landing-pages are NOT theme packs and stay as they are.
// People who already own a pack keep it (their entitlement is untouched).
//
// Usage: TARGET_DATABASE_URL=<connection string> npx tsx scripts/make-theme-packs-paid.ts              (dry run)
//        TARGET_DATABASE_URL=<connection string> npx tsx scripts/make-theme-packs-paid.ts --confirm    (writes)
// The database is named explicitly on purpose: this script never reads POSTGRES_URL / DATABASE_URL.
import { Pool } from 'pg';

const THEME_PACK_SLUGS = [
  'blackline-agency-theme',
  'bella-nota-restaurant-theme',
  'larkspur-real-estate-theme',
  'tidewell-wellness-studio-theme',
];
const PRICE_CENTS = 1200;

async function main() {
  const url = process.env.TARGET_DATABASE_URL;
  if (!url) throw new Error('set TARGET_DATABASE_URL to the database to change');
  const confirm = process.argv.includes('--confirm');
  console.log(`DB host: ${new URL(url).host}   confirm=${confirm}`);
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query('select slug, kind, price_cents from packs where slug = any($1)', [THEME_PACK_SLUGS]);
    for (const s of THEME_PACK_SLUGS) {
      const r = rows.find((x) => x.slug === s);
      console.log(`  ${r ? `${r.kind}/${r.price_cents ?? 'null'} -> paid/${PRICE_CENTS}` : 'NOT IN THIS DB'}  ${s}`);
    }
    if (!confirm) { console.log('\nDRY RUN: nothing written. Re-run with --confirm.'); return; }
    const done = await pool.query("update packs set kind = 'paid', price_cents = $2 where slug = any($1) returning slug", [THEME_PACK_SLUGS, PRICE_CENTS]);
    console.log(`\nupdated ${done.rowCount} pack(s): ${done.rows.map((r) => r.slug).join(', ')}`);
  } finally {
    await pool.end();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
