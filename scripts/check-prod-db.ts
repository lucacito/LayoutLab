/**
 * Answers one question: does POSTGRES_URL actually connect?
 *
 * Exists because the failure it catches was previously only discoverable by
 * attempting a real release — a rotated Neon password surfaced as a Drizzle
 * stack trace wrapped around `28P01`, after the zip had already been uploaded.
 * A stale local .env.prod is a normal, recurring state: Vercel holds the live
 * value and will not hand it back, so this file drifts every time a secret
 * rotates.
 */
import { sql } from '@vercel/postgres';

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('  DB: POSTGRES_URL is not set');
    process.exit(1);
  }

  const host = url.replace(/.*@([^/?]+).*/, '$1');

  try {
    const { rows } = await sql`select count(*)::int as n from plugin_releases`;
    console.log(`  DB: connected to ${host} — plugin_releases has ${rows[0].n} row(s)`);
    process.exit(0);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    // @vercel/postgres does not always preserve the driver's `code`, so match
    // the message as well — otherwise a stale password falls through to the
    // generic branch and loses the guidance that makes it actionable.
    const isAuthFailure =
      e.code === '28P01' || /password authentication failed/i.test(e.message ?? '');

    if (isAuthFailure) {
      console.error(`  DB: password rejected by ${host} (28P01).`);
      console.error('      The password in .env.prod is stale — it predates the last');
      console.error('      Neon rotation. Copy the current POOLED connection string');
      console.error('      from the Neon console into DATABASE_URL in .env.prod.');
      console.error('      Do NOT reset the password again: Vercel holds the working');
      console.error('      one and will not show it back, so a second rotation would');
      console.error('      take divi5lab.com down until you updated it there too.');
    } else {
      console.error(`  DB: could not query ${host} — ${e.code ?? ''} ${e.message ?? err}`);
    }
    process.exit(1);
  }
}

main();
