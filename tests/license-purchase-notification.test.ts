import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn(async (_m: { to: string; subject: string; html: string; text: string }) => ({ sent: true })) }));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/email', () => ({ sendEmail }));
vi.mock('@/lib/auth/sign-in-url', () => ({ createMagicSignInUrl: vi.fn(async () => 'https://divi5lab.com/signin?t=1'), signInUrlDeps: {} }));
vi.mock('@/lib/users/find-or-create', () => ({ findOrCreateUserByEmail: vi.fn() }));

import { dbStore } from '@/lib/stripe/fulfillment-store';
import { PRICING } from '@/lib/pricing/config';

const order = { amountCents: 31430, discountCents: 13470, currency: 'usd', paidAt: new Date('2026-10-04T15:00:00Z'), reference: 'pi_9' };
const base = { email: 'buyer@x.com', productSlug: PRICING.product, licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD' };

beforeEach(() => sendEmail.mockClear());

describe('dbStore.notifyLicensePurchase sends the receipt inside the licence email', () => {
  it('a founding Lifetime purchase: plan, exact amount, discount and reference', async () => {
    await dbStore.notifyLicensePurchase({ ...base, tier: 'agency', lifetime: true, trial: false, order });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe('buyer@x.com');
    expect(mail.subject).toBe('Your AI Editor for Divi 5 Pro license key and receipt');
    expect(mail.text).toContain('Plan: Agency (Lifetime)');
    expect(mail.text).toContain('Amount paid: $314.30 USD');
    expect(mail.text).toContain('Discount applied: $134.70');
    expect(mail.text).toContain('Reference: pi_9');
  });

  it('an annual purchase is labelled annual', async () => {
    await dbStore.notifyLicensePurchase({ ...base, tier: 'personal', lifetime: false, trial: false, order: { ...order, amountCents: 4900, discountCents: 0 } });
    expect(sendEmail.mock.calls[0][0].text).toContain('Plan: Personal (annual)');
  });

  it('a trial is labelled a free trial and says no charge', async () => {
    await dbStore.notifyLicensePurchase({ ...base, tier: 'personal', lifetime: false, trial: true, order: { ...order, amountCents: 0, discountCents: 0 } });
    const t = sendEmail.mock.calls[0][0].text;
    expect(t).toContain('Plan: Personal (free trial)');
    expect(t).toContain('No charge today');
  });

  it('with no order the email is the plain licence email (no receipt claimed)', async () => {
    await dbStore.notifyLicensePurchase({ ...base, tier: 'personal', lifetime: false });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.subject).toBe('Your AI Editor for Divi 5 Pro license key');
    expect(mail.text).not.toContain('Order summary');
  });
});
