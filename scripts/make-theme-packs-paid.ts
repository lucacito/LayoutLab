// Make every theme pack a paid pack at the one theme pack price ($12.00, sold on STRIPE_THEME_PACK).
// Section collections such as premium-landing-pages are NOT theme packs and stay as they are.
//
// Usage: npx tsx scripts/make-theme-packs-paid.ts              (dry run: shows what would change)
//        npx tsx scripts/make-theme-packs-paid.ts --confirm    (writes the DB named by POSTGRES_URL / DATABASE_URL)
import { inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';

const THEME_PACK_SLUGS = [
  'blackline-agency-theme',
  'bella-nota-restaurant-theme',
  'larkspur-real-estate-theme',
  'tidewell-wellness-studio-theme',
];
const PRICE_CENTS = 1200;

async function main() {
  const confirm = process.argv.includes('--confirm');
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';
  console.log(`DB host: ${url ? new URL(url).host : '(unset)'}   confirm=${confirm}`);
  const rows = await db.select({ id: packs.id, slug: packs.slug, kind: packs.kind, price: packs.priceCents }).from(packs).where(inArray(packs.slug, THEME_PACK_SLUGS));
  for (const s of THEME_PACK_SLUGS) {
    const r = rows.find((x) => x.slug === s);
    console.log(`  ${r ? `${r.kind}/${r.price ?? 'null'} -> paid/${PRICE_CENTS}` : 'NOT IN THIS DB'}  ${s}`);
  }
  if (!confirm) { console.log('\nDRY RUN: nothing written. Re-run with --confirm.'); return; }
  const done = await db.update(packs).set({ kind: 'paid', priceCents: PRICE_CENTS }).where(inArray(packs.slug, THEME_PACK_SLUGS)).returning({ slug: packs.slug });
  console.log(`\nupdated ${done.length} pack(s)`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
