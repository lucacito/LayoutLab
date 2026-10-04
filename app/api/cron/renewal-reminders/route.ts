/**
 * Daily cron (vercel.json): email a renewal reminder 30 and 7 days before an AI Editor subscription renews.
 * GET /api/cron/renewal-reminders  with  Authorization: Bearer <CRON_SECRET>  (Vercel Cron sends this itself).
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { licenses, licenseReminders, users } from '@/db/schema';
import { PRICING } from '@/lib/pricing/config';
import { dueReminders, type LicenseWithReminders } from '@/lib/license-server/reminders';
import { renewalReminderEmail } from '@/lib/email/renewal-reminder';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

function authorised(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  if (!authorised(req, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const origin = env.NEXT_PUBLIC_SITE_URL;

  try {
    const candidates = await db.select().from(licenses).where(and(
      eq(licenses.productSlug, PRICING.product),
      eq(licenses.status, 'active'),
      eq(licenses.lifetime, false),
      eq(licenses.trial, false),
    ));

    const withRecorded: LicenseWithReminders[] = [];
    for (const lic of candidates) {
      if (!lic.currentPeriodEnd) continue;
      const recorded = await db.select({ days: licenseReminders.days }).from(licenseReminders).where(and(
        eq(licenseReminders.licenseId, lic.id),
        eq(licenseReminders.periodEnd, lic.currentPeriodEnd),
      ));
      withRecorded.push({
        id: lic.id, userId: lic.userId, productSlug: lic.productSlug, licenseKey: lic.licenseKey,
        status: lic.status, currentPeriodEnd: lic.currentPeriodEnd,
        tier: lic.tier, founding: lic.founding, lifetime: lic.lifetime, trial: lic.trial,
        recordedDays: recorded.map((r) => r.days),
      });
    }

    let sent = 0;
    let failed = 0;
    for (const due of dueReminders(withRecorded, now)) {
      const record = (days: number[]) => db.insert(licenseReminders)
        .values(days.map((d) => ({ id: randomUUID(), licenseId: due.license.id, days: d, periodEnd: due.periodEnd })))
        .onConflictDoNothing()
        .returning({ days: licenseReminders.days });

      // Windows that were reached late are settled silently so they never email on a later day.
      if (due.settle.length > 0) await record(due.settle);
      if (due.send === null) continue;

      // Claim the reminder BEFORE sending: a crash after the claim loses one email, never duplicates it; a send that
      // fails releases the claim so the next run retries.
      const claimed = await record([due.send]);
      if (claimed.length === 0) continue;

      const user = await db.select({ email: users.email }).from(users).where(eq(users.id, due.license.userId)).limit(1);
      const tierLabel = PRICING.tiers.find((t) => t.id === due.license.tier)?.label ?? 'Pro';
      let ok = false;
      if (user[0]) {
        try {
          const mail = renewalReminderEmail({ email: user[0].email, tierLabel, renewalDate: due.periodEnd, manageUrl: `${origin}${PRICING.urls.account}` });
          ok = (await sendEmail({ to: user[0].email, subject: mail.subject, html: mail.html, text: mail.text })).sent;
        } catch (err) {
          console.error('[renewal-reminder] email send failed:', err);
        }
      }
      if (ok) {
        sent++;
      } else {
        failed++;
        await db.delete(licenseReminders).where(and(
          eq(licenseReminders.licenseId, due.license.id),
          inArray(licenseReminders.days, [due.send]),
          eq(licenseReminders.periodEnd, due.periodEnd),
        ));
      }
    }

    return NextResponse.json({ ok: true, checked: candidates.length, sent, failed });
  } catch (err) {
    console.error('[renewal-reminder] cron job failed:', err);
    return NextResponse.json({ error: 'job_failed' }, { status: 500 });
  }
}
