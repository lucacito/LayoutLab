import { describe, it, expect } from 'vitest';
import { licenseKeyEmail } from '@/lib/email/license-email';

const base = { productTitle: 'AI Editor for Divi 5 Pro', licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', signInUrl: 'https://divi5lab.com/x' };

describe('licenseKeyEmail', () => {
  it('keeps the legacy wording for converters (no tier given)', () => {
    expect(licenseKeyEmail(base).text).toContain('Your license covers unlimited sites and renews yearly.');
  });
  it('states one site for a one-site tier', () => {
    const t = licenseKeyEmail({ ...base, tierLabel: 'Personal', sitesAllowed: 1 }).text;
    expect(t).toContain('Your Personal licence covers 1 site and renews yearly.');
    expect(t).not.toContain('unlimited');
  });
  it('states the number for a multi-site tier', () => {
    expect(licenseKeyEmail({ ...base, tierLabel: 'Freelancer', sitesAllowed: 10 }).text).toContain('covers 10 sites and renews yearly');
  });
  it('says unlimited for an unlimited tier', () => {
    expect(licenseKeyEmail({ ...base, tierLabel: 'Agency', sitesAllowed: null }).text).toContain('covers unlimited sites and renews yearly');
  });
  it('lifetime has no renewal and keeps the lapse promise', () => {
    const t = licenseKeyEmail({ ...base, tierLabel: 'Agency', sitesAllowed: null, lifetime: true }).text;
    expect(t).toContain('single payment and no renewal');
    expect(t).not.toContain('renews yearly');
    expect(t).toContain('everything keeps working');
  });
  it('shows the key in the html', () => {
    expect(licenseKeyEmail(base).html).toContain('<strong>JHMG-AAAA-BBBB-CCCC-DDDD</strong>');
  });
});
