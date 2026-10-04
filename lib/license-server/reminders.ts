/**
 * Renewal reminder logic: find licenses due for reminder emails
 */
import type { LicenseRecord } from './core';
import { PRICING } from '@/lib/pricing/config';

export interface ReminderDue {
  license: LicenseRecord;
  days: number;
  periodEnd: Date;
}

export interface LicenseWithReminders extends LicenseRecord {
  recordedDays: number[];
}

/**
 * Find licenses due for renewal reminders.
 * Only returns active subscription licenses of PRICING.product whose period end
 * is within each reminder window and not yet recorded in license_reminders.
 */
export function dueReminders(
  licenses: LicenseWithReminders[],
  now: Date,
  days: number[] = PRICING.renewalReminderDays,
): ReminderDue[] {
  const result: ReminderDue[] = [];

  for (const license of licenses) {
    // Skip non-AI Editor licenses
    if (license.productSlug !== PRICING.product) continue;

    // Skip non-active or lifetime licenses
    if (license.status !== 'active' || license.lifetime) continue;

    // Get the period end date
    const periodEnd = license.currentPeriodEnd;
    if (!periodEnd) continue;

    // For each reminder window (e.g., 30 days, 7 days before expiry)
    for (const daysBefore of days) {
      // Skip if already recorded for this days/periodEnd combination
      if (license.recordedDays.includes(daysBefore)) continue;

      // Calculate the window: from (periodEnd - daysBefore days) to (periodEnd - (daysBefore - 1) days)
      // For a 30-day reminder on Oct 4, expiry Nov 3: window is Oct 4 to Oct 5
      const windowStart = new Date(periodEnd.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(periodEnd.getTime() - (daysBefore - 1) * 24 * 60 * 60 * 1000);

      // Check if now is within the reminder window
      if (now.getTime() >= windowStart.getTime() && now.getTime() < windowEnd.getTime()) {
        result.push({
          license,
          days: daysBefore,
          periodEnd,
        });
      }
    }
  }

  return result;
}
