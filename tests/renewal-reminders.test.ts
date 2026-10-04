import { describe, it, expect } from 'vitest';
import { dueReminders, type LicenseWithReminders } from '@/lib/license-server/reminders';
import { renewalReminderEmail } from '@/lib/email/renewal-reminder';
import { PRICING } from '@/lib/pricing/config';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-04T12:00:00Z');
const endIn = (days: number) => new Date(now.getTime() + days * DAY);

const lic = (over: Partial<LicenseWithReminders> = {}): LicenseWithReminders => ({
  id: 'lic_1', userId: 'u1', productSlug: PRICING.product, licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
  status: 'active', currentPeriodEnd: endIn(200), tier: 'personal', founding: false, lifetime: false, trial: false,
  recordedDays: [], ...over,
});

describe('dueReminders', () => {
  it('sends nothing when no window has been reached', () => {
    expect(dueReminders([lic()], now)).toEqual([]);
  });

  it('sends the longest window once it is reached', () => {
    const [d] = dueReminders([lic({ currentPeriodEnd: endIn(29) })], now);
    expect(d).toMatchObject({ send: 30, settle: [] });
  });

  it('sends the short window when only it is open', () => {
    const [d] = dueReminders([lic({ currentPeriodEnd: endIn(6), recordedDays: [30] })], now);
    expect(d).toMatchObject({ send: 7, settle: [] });
  });

  it('never sends the same window twice for the same period', () => {
    expect(dueReminders([lic({ currentPeriodEnd: endIn(29), recordedDays: [30] })], now)).toEqual([]);
  });

  it('a late start sends ONE email for the smallest window and settles the larger one silently', () => {
    const [d] = dueReminders([lic({ currentPeriodEnd: endIn(5) })], now);
    expect(d).toMatchObject({ send: 7, settle: [30] });
  });

  it('a missed cron day does not lose the reminder: it fires the next day it runs', () => {
    const [d] = dueReminders([lic({ currentPeriodEnd: endIn(28.5) })], now);
    expect(d?.send).toBe(30);
  });

  it('once the short window is already recorded, a stale larger window only settles, never emails', () => {
    const [d] = dueReminders([lic({ currentPeriodEnd: endIn(3), recordedDays: [7] })], now);
    expect(d).toMatchObject({ send: null, settle: [30] });
  });

  it('a renewed period (new end date, nothing recorded for it) is eligible again', () => {
    expect(dueReminders([lic({ currentPeriodEnd: endIn(29), recordedDays: [] })], now)).toHaveLength(1);
  });

  it.each([
    ['another product', { productSlug: 'elementor-to-divi5-pro' }],
    ['a lifetime licence', { lifetime: true }],
    ['a free trial', { trial: true }],
    ['a cancelled licence', { status: 'canceled' as const }],
    ['an expired licence', { status: 'expired' as const }],
    ['a revoked licence', { status: 'revoked' as const }],
    ['a past-due licence', { status: 'past_due' as const }],
    ['a licence with no period end', { currentPeriodEnd: null }],
    ['a licence whose period already ended', { currentPeriodEnd: endIn(-1) }],
  ])('skips %s', (_n, over) => {
    expect(dueReminders([lic({ currentPeriodEnd: endIn(5), ...over })], now)).toEqual([]);
  });
});

describe('renewalReminderEmail', () => {
  const mail = renewalReminderEmail({ email: 'a@b.c', tierLabel: 'Freelancer', renewalDate: new Date('2027-01-15T00:00:00Z'), manageUrl: 'https://divi5lab.com/account/licenses' });
  it('names the date, the tier, the automatic charge and the manage link', () => {
    expect(mail.subject).toContain('January 15, 2027');
    expect(mail.text).toContain('Freelancer');
    expect(mail.text).toContain('charged automatically');
    expect(mail.text).toContain('https://divi5lab.com/account/licenses');
    expect(mail.html).toContain('href="https://divi5lab.com/account/licenses"');
  });
  it('promises that nothing stops working if the licence ends, and states no price', () => {
    expect(mail.text).toContain('everything keeps working');
    expect(mail.text + mail.html).not.toMatch(/\$\s?\d/);
  });
  it('escapes the tier label in the HTML', () => {
    expect(renewalReminderEmail({ email: 'a@b.c', tierLabel: '<b>x</b>', renewalDate: new Date(), manageUrl: 'https://x.y' }).html).not.toContain('<b>x</b>');
  });
});
