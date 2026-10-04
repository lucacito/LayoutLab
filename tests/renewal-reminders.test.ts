import { describe, it, expect } from 'vitest';
import { dueReminders, type LicenseWithReminders } from '@/lib/license-server/reminders';
import { PRICING } from '@/lib/pricing/config';

describe('dueReminders', () => {
  const baseDate = new Date('2026-10-04T12:00:00Z');
  const expiryDate30 = new Date('2026-11-03T00:00:00Z'); // 30 days from base
  const expiryDate7 = new Date('2026-10-11T00:00:00Z'); // 7 days from base

  const createLicense = (
    override: Partial<LicenseWithReminders> = {},
  ): LicenseWithReminders => ({
    id: 'lic_1',
    userId: 'u1',
    productSlug: PRICING.product,
    licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
    status: 'active',
    currentPeriodEnd: expiryDate30,
    tier: 'personal',
    founding: false,
    lifetime: false,
    recordedDays: [],
    ...override,
  });

  it('returns no reminders when no licenses are provided', () => {
    const result = dueReminders([], baseDate);
    expect(result).toEqual([]);
  });

  it('skips non-AI-Editor product licenses', () => {
    const lic = createLicense({ productSlug: 'elementor-to-divi5-pro' });
    const result = dueReminders([lic], baseDate);
    expect(result).toEqual([]);
  });

  it('skips non-active licenses', () => {
    const lic = createLicense({ status: 'canceled' });
    const result = dueReminders([lic], baseDate);
    expect(result).toEqual([]);
  });

  it('skips lifetime licenses', () => {
    const lic = createLicense({ lifetime: true });
    const result = dueReminders([lic], baseDate);
    expect(result).toEqual([]);
  });

  it('skips licenses with no period end', () => {
    const lic = createLicense({ currentPeriodEnd: null });
    const result = dueReminders([lic], baseDate);
    expect(result).toEqual([]);
  });

  it('returns a 30-day reminder when within the window', () => {
    const lic = createLicense({ currentPeriodEnd: expiryDate30 });
    // Expiry: Nov 3, so 30-day window is Oct 4-5
    const now = new Date('2026-10-04T12:00:00Z'); // Within 30-day window
    const result = dueReminders([lic], now, [30]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      days: 30,
      periodEnd: expiryDate30,
      license: expect.objectContaining({ id: 'lic_1' }),
    });
  });

  it('returns a 7-day reminder when within the window', () => {
    const lic = createLicense({ currentPeriodEnd: expiryDate7 });
    // Expiry: Oct 11, so 7-day window is Oct 4-5
    const now = new Date('2026-10-04T12:00:00Z'); // Within 7-day window
    const result = dueReminders([lic], now, [7]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      days: 7,
      periodEnd: expiryDate7,
    });
  });

  it('skips reminders already recorded', () => {
    const lic = createLicense({
      currentPeriodEnd: expiryDate30,
      recordedDays: [30],
    });
    const now = new Date('2026-11-02T00:00:00Z');
    const result = dueReminders([lic], now, [30]);
    expect(result).toEqual([]);
  });

  it('does not return a reminder outside the window', () => {
    const lic = createLicense({ currentPeriodEnd: expiryDate30 });
    const now = new Date('2026-10-01T00:00:00Z'); // Too early (>30 days away from Nov 3)
    const result = dueReminders([lic], now, [30]);
    expect(result).toEqual([]);
  });

  it('returns both 30-day and 7-day reminders for a license with two expiry dates', () => {
    const lic1 = createLicense({
      id: 'lic_1',
      currentPeriodEnd: expiryDate30,
    });
    const lic2 = createLicense({
      id: 'lic_2',
      currentPeriodEnd: expiryDate7,
    });
    const now = new Date('2026-10-04T12:00:00Z'); // Within both windows
    const result = dueReminders([lic1, lic2], now, [30, 7]);
    expect(result).toHaveLength(2);
    expect(result[0]?.days).toBe(30);
    expect(result[1]?.days).toBe(7);
  });

  it('handles multiple licenses', () => {
    const lic1 = createLicense({ id: 'lic_1' });
    const lic2 = createLicense({ id: 'lic_2', currentPeriodEnd: expiryDate7 });
    const now = new Date('2026-10-04T12:00:00Z'); // Within both 30-day and 7-day windows
    const result = dueReminders([lic1, lic2], now, [30, 7]);
    // Both licenses should have reminders due
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.license.id).sort();
    expect(ids).toEqual(['lic_1', 'lic_2']);
  });
});
