import { describe, it, expect } from 'vitest';
import { licenseKeyEmail } from '@/lib/email/license-email';

describe('licenseKeyEmail', () => {
  it('includes product title, key and sign-in url in text and html', () => {
    const { subject, html, text } = licenseKeyEmail({
      productTitle: 'JHMG Converter For Elementor to Divi 5 — Pro',
      licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
      signInUrl: 'https://divi5lab.com/login?x=1',
    });
    expect(subject).toContain('license key');
    for (const out of [html, text]) {
      expect(out).toContain('JHMG-AAAA-BBBB-CCCC-DDDD');
      expect(out).toContain('https://divi5lab.com/login?x=1');
    }
  });
});
