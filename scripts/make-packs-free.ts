// Flip every pack to kind='free' (marketplace demotion — plugins are the paid product).
// Usage: npx tsx scripts/make-packs-free.ts        (uses env DATABASE_URL/POSTGRES_URL)
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';

async function main() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';
  console.error('flipping packs on DB host:', url ? new URL(url).host : '(unset)');
  const updated = await db.update(packs).set({ kind: 'free', priceCents: null }).where(eq(packs.kind, 'paid')).returning({ id: packs.id, slug: packs.slug });
  console.log(`made free: ${updated.length} packs`);
  for (const p of updated) console.log(' -', p.slug);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
