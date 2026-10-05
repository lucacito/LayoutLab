import { describe, it, expect } from 'vitest';
import { licenseKeyEmail } from '@/lib/email/license-email';

const base = { productTitle: 'AI Editor for Divi 5 Pro', licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', signInUrl: 'https://divi5lab.com/x' };
const order = { planLabel: 'Agency (Lifetime)', amountCents: 31430, discountCents: 13470, currency: 'usd', paidAt: new Date('2026-10-04T15:00:00Z'), reference: 'pi_3Abc' };

describe('the purchase email doubles as the receipt', () => {
  it('lists plan, date, exact amount paid with cents, the discount and the Stripe reference', () => {
    const t = licenseKeyEmail({ ...base, order }).text;
    expect(t).toContain('Order summary');
    expect(t).toContain('Plan: Agency (Lifetime)');
    expect(t).toContain('Date: Oct 4, 2026');
    expect(t).toContain('Amount paid: $314.30 USD');
    expect(t).toContain('Discount applied: $134.70');
    expect(t).toContain('Reference: pi_3Abc');
  });

  it('says so in the subject and tells the buyer how to get an invoice with company details', () => {
    const e = licenseKeyEmail({ ...base, order });
    expect(e.subject).toBe('Your AI Editor for Divi 5 Pro license key and receipt');
    expect(e.text).toContain('support@divi5lab.com');
  });

  it('omits the discount line when nothing was discounted', () => {
    const t = licenseKeyEmail({ ...base, order: { ...order, amountCents: 44900, discountCents: 0 } }).text;
    expect(t).toContain('Amount paid: $449.00 USD');
    expect(t).not.toContain('Discount applied');
  });

  it('a free trial says no charge instead of showing a zero receipt', () => {
    const t = licenseKeyEmail({ ...base, order: { ...order, planLabel: 'Personal (free trial)', amountCents: 0, discountCents: 0, reference: 'cs_trial' } }).text;
    expect(t).toContain('No charge today');
    expect(t).not.toContain('Amount paid');
  });

  it('puts the summary in the html too', () => {
    expect(licenseKeyEmail({ ...base, order }).html).toContain('Amount paid: $314.30 USD');
  });

  it('is unchanged when no order is given (same subject, no summary)', () => {
    const e = licenseKeyEmail(base);
    expect(e.subject).toBe('Your AI Editor for Divi 5 Pro license key');
    expect(e.text).not.toContain('Order summary');
  });
});
