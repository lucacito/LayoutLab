/**
 * Renewal reminders: which subscription licences are due an email, and which reminder windows that email settles.
 */
import type { LicenseRecord } from './core';
import { PRICING } from '@/lib/pricing/config';

export interface LicenseWithReminders extends LicenseRecord {
  /** Reminder windows (days) already recorded for the licence's CURRENT period end. */
  recordedDays: number[];
}

export interface ReminderDue {
  license: LicenseRecord;
  periodEnd: Date;
  /** The window to email for: the smallest one reached, when it is not yet recorded. null = nothing to email. */
  send: number | null;
  /** Other reached windows not yet recorded (a late start or a missed cron day): record them, never email them. */
  settle: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A window is reached once `now >= periodEnd - days` and the period has not ended. A licence gets at most ONE email per
 * run (for the smallest reached window), so a cron outage or a licence bought late never sends two emails at once, and a
 * missed day does not lose the reminder. Only running, paid, renewing subscription licences of PRICING.product qualify:
 * never lifetime, never a free trial (it does not renew), never cancelled, expired or revoked ones.
 */
export function dueReminders(
  licenses: LicenseWithReminders[],
  now: Date,
  days: number[] = PRICING.renewalReminderDays,
): ReminderDue[] {
  const result: ReminderDue[] = [];
  const windows = [...days].sort((a, b) => a - b);

  for (const license of licenses) {
    if (license.productSlug !== PRICING.product) continue;
    if (license.status !== 'active' || license.lifetime || license.trial) continue;
    const periodEnd = license.currentPeriodEnd;
    if (!periodEnd || periodEnd.getTime() <= now.getTime()) continue;

    const reached = windows.filter((d) => now.getTime() >= periodEnd.getTime() - d * DAY_MS);
    const open = reached.filter((d) => !license.recordedDays.includes(d));
    if (open.length === 0) continue;

    const smallestReached = reached[0] as number;
    const send = open.includes(smallestReached) ? smallestReached : null;
    result.push({ license, periodEnd, send, settle: open.filter((d) => d !== send) });
  }

  return result;
}
