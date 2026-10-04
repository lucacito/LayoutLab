/**
 * Cron job: send renewal reminder emails for licenses expiring soon
 * GET /api/cron/renewal-reminders?secret=<CRON_SECRET>
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { licenses, licenseReminders, users } from '@/db/schema';
import { eq, and, isNull, not } from 'drizzle-orm';
import { PRICING } from '@/lib/pricing/config';
import { dueReminders, type LicenseWithReminders } from '@/lib/license-server/reminders';
import { renewalReminderEmail } from '@/lib/email/renewal-reminder';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

async function sendReminderEmail(
  email: string,
  tierLabel: string,
  expiryDate: Date,
  origin: string,
): Promise<boolean> {
  try {
    const manageUrl = `${origin}${PRICING.urls.account}`;
    const { subject, html, text } = renewalReminderEmail({
      email,
      tierLabel,
      expiryDate,
      manageUrl,
    });
    const { sent } = await sendEmail({ to: email, subject, html, text });
    return sent;
  } catch (err) {
    console.error('[renewal-reminder] email send failed:', err);
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  // Verify cron secret
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const providedSecret = url.searchParams.get('secret');
  if (providedSecret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const origin = env.NEXT_PUBLIC_SITE_URL || 'https://divi5lab.com';

  try {
    // Fetch active subscription licenses of PRICING.product that haven't been cancelled/expired
    const activeLicenses = await db.select()
      .from(licenses)
      .where(
        and(
          eq(licenses.productSlug, PRICING.product),
          eq(licenses.status, 'active'),
          eq(licenses.lifetime, false),
          not(isNull(licenses.currentPeriodEnd)),
        ),
      );

    // For each license, get already-recorded reminder days
    const licensesByIdWithRecorded: LicenseWithReminders[] = await Promise.all(
      activeLicenses.map(async (lic) => {
        const recorded = await db.select({ days: licenseReminders.days })
          .from(licenseReminders)
          .where(
            and(
              eq(licenseReminders.licenseId, lic.id),
              eq(licenseReminders.periodEnd, lic.currentPeriodEnd!),
            ),
          );
        return {
          ...lic,
          recordedDays: recorded.map((r) => r.days),
        };
      }),
    );

    // Find licenses due for reminders
    const due = dueReminders(licensesByIdWithRecorded, now);

    let sent = 0;
    let failed = 0;

    // Send emails and record in license_reminders table
    for (const reminder of due) {
      const user = await db.select({ email: users.email })
        .from(users)
        .where(eq(users.id, reminder.license.userId))
        .limit(1);

      if (!user[0]) {
        failed++;
        continue;
      }

      const tierLabel = PRICING.tiers.find((t) => t.id === reminder.license.tier)?.label || 'Unknown';

      // Send email
      const emailSent = await sendReminderEmail(user[0].email, tierLabel, reminder.periodEnd, origin);

      if (!emailSent) {
        failed++;
        continue;
      }

      // Record in license_reminders table (idempotent: unique index on license_id, days, period_end)
      try {
        await db.insert(licenseReminders).values({
          id: randomUUID(),
          licenseId: reminder.license.id,
          days: reminder.days,
          periodEnd: reminder.periodEnd,
        }).onConflictDoNothing();
        sent++;
      } catch (err) {
        console.error('[renewal-reminder] failed to record reminder:', err);
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      checked: activeLicenses.length,
    });
  } catch (err) {
    console.error('[renewal-reminder] cron job failed:', err);
    return NextResponse.json({ error: 'job_failed', detail: String(err) }, { status: 500 });
  }
}
