import { describe, it, expect } from 'vitest';
import { purchaseReceiptEmail } from '@/lib/email/receipt';

const URL = 'https://divi5lab.com/api/auth/callback/email?token=abc&email=a%40b.com';

describe('purchaseReceiptEmail', () => {
  it('pack receipt: contains the pack title, amount, and the one-click sign-in URL', () => {
    const m = purchaseReceiptEmail({ kind: 'pack', packTitle: 'Bold SaaS Heroes', amountCents: 4900, signInUrl: URL });
    expect(m.subject).toMatch(/receipt|purchase|thank/i);
    expect(m.html).toContain('Bold SaaS Heroes');
    expect(m.html).toContain('$49');
    expect(m.html).toContain(URL);
    expect(m.text).toContain(URL);
  });

  it('membership receipt: names all-access and contains the sign-in URL', () => {
    const m = purchaseReceiptEmail({ kind: 'membership', signInUrl: URL });
    expect(m.html).toMatch(/all-access|membership/i);
    expect(m.html).toContain(URL);
    expect(m.text).toContain(URL);
  });
});
