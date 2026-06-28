import { describe, it, expect } from 'vitest';
import { buildCheckoutSessionParams } from '@/lib/stripe/checkout';
import { POST } from '@/app/api/checkout/route';

const ctx = { siteUrl: 'https://layoutlab.com', automaticTax: true };

describe('buildCheckoutSessionParams', () => {
  it('builds a one-time payment session for a pack', () => {
    const p = buildCheckoutSessionParams({ kind: 'pack', packId: 'pk1' }, { ...ctx, packPriceId: 'price_pack' });
    expect(p.mode).toBe('payment');
    expect(p.line_items).toEqual([{ price: 'price_pack', quantity: 1 }]);
    expect(p.metadata).toEqual({ kind: 'pack', packId: 'pk1' });
    expect(p.success_url).toContain('/checkout/success');
    expect(p.cancel_url).toContain('/checkout/cancel');
    expect((p.automatic_tax as any).enabled).toBe(true);
  });
  it('builds a subscription session for membership', () => {
    const p = buildCheckoutSessionParams({ kind: 'membership', plan: 'yearly' }, { ...ctx, membershipPriceId: 'price_year' });
    expect(p.mode).toBe('subscription');
    expect(p.line_items).toEqual([{ price: 'price_year', quantity: 1 }]);
    expect(p.metadata).toEqual({ kind: 'membership', plan: 'yearly' });
  });
});

function post(body: unknown) {
  return new Request('http://test/api/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/checkout — validation (no Stripe/DB)', () => {
  it('400 on invalid JSON', async () => {
    expect((await POST(post('not json{'))).status).toBe(400);
  });
  it('400 on an invalid body shape', async () => {
    expect((await POST(post({ kind: 'bogus' }))).status).toBe(400);
  });
  it('400 when a membership plan has no configured price', async () => {
    // STRIPE_PRICE_MEMBERSHIP_* are 'price_test_*' in test.env, so use an out-of-range plan shape:
    expect((await POST(post({ kind: 'membership' }))).status).toBe(400); // missing plan
  });
});
