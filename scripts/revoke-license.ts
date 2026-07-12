// Revoke (or restore) a plugin license. Revocation is the ONLY thing that
// re-locks the AI Editor's premium features on customer sites (see the plugin's
// sticky-unlock semantics); converters are soft-enforced and unaffected.
// Usage: npx tsx scripts/revoke-license.ts --key JHMG-XXXX-XXXX-XXXX-XXXX
//        npx tsx scripts/revoke-license.ts --key JHMG-... --restore canceled
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { licenses } from '@/db/schema';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = arg('key');
  const restore = arg('restore'); // e.g. 'canceled' to undo a mistaken revoke
  if (!key) { console.error('Usage: --key JHMG-... [--restore <status>]'); process.exit(1); }
  const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (dbUrl) {
    console.error('operating against DB host:', new URL(dbUrl).host);
  }
  const status = (restore ?? 'revoked') as typeof licenses.$inferSelect.status;
  const rows = await db.update(licenses).set({ status }).where(eq(licenses.licenseKey, key)).returning();
  if (rows.length === 0) { console.error(`No license found for key ${key}`); process.exit(1); }
  console.log(`License ${rows[0]!.id} (${rows[0]!.productSlug}) -> ${status}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
