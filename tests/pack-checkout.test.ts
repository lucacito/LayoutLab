import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  create: vi.fn(),
  retrievePrice: vi.fn(),
  resolvePack: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));
vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: h.create } }, prices: { retrieve: h.retrievePrice } },
}));
vi.mock('@/lib/stripe/pack-checkout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe/pack-checkout')>();
  return { ...actual, resolvePackForCheckout: h.resolvePack };
});
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env } };
});

import { POST } from '@/app/api/checkout/route';
import { env as mockEnv } from '@/lib/env';
import { themePackPriceProblem } from '@/lib/stripe/pack-checkout';

const post = (body: unknown) =>
  new Request('http://test/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const livePack = { id: 'pk1', slug: 'tidewell-wellness-studio-theme', status: 'published', kind: 'paid', priceCents: 1200 };
const goodPrice = { id: 'price_tp', active: true, type: 'one_time', currency: 'usd', unit_amount: 1200 };

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.STRIPE_THEME_PACK = 'price_tp';
  h.resolvePack.mockResolvedValue(livePack);
  h.retrievePrice.mockResolvedValue(goodPrice);
  h.create.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
});

describe('themePackPriceProblem', () => {
  it('accepts an active one-time USD price equal to the pack price', () => {
    expect(themePackPriceProblem(goodPrice as never, 1200)).toBeNull();
  });
  it.each([
    [{ ...goodPrice, active: false }, 'inactive'],
    [{ ...goodPrice, type: 'recurring' }, 'not_one_time'],
    [{ ...goodPrice, currency: 'eur' }, 'wrong_currency'],
    [{ ...goodPrice, unit_amount: 1500 }, 'amount_mismatch'],
    [{ ...goodPrice, unit_amount: null }, 'amount_mismatch'],
  ])('refuses %o as %s', (price, why) => {
    expect(themePackPriceProblem(price as never, 1200)).toBe(why);
  });
  it('refuses when the pack has no price', () => {
    expect(themePackPriceProblem(goodPrice as never, null)).toBe('amount_mismatch');
  });
});

describe('POST /api/checkout, kind pack', () => {
  it('creates a one-time payment session on the theme pack price with pack metadata', async () => {
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_1' });
    const params = h.create.mock.calls[0][0];
    expect(params.mode).toBe('payment');
    expect(params.line_items).toEqual([{ price: 'price_tp', quantity: 1 }]);
    expect(params.metadata).toEqual({ kind: 'pack', packId: 'pk1' });
  });

  it('400 pack_unavailable when the pack is missing, unpublished or free', async () => {
    for (const p of [null, { ...livePack, status: 'draft' }, { ...livePack, kind: 'free' }]) {
      h.resolvePack.mockResolvedValue(p);
      const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'pack_unavailable' });
    }
    expect(h.create).not.toHaveBeenCalled();
  });

  it('400 pack_unavailable when STRIPE_THEME_PACK is not configured, before any Stripe call', async () => {
    mockEnv.STRIPE_THEME_PACK = undefined;
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'pack_unavailable' });
    expect(h.retrievePrice).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  it('refuses to charge when the Stripe price does not match the pack price', async () => {
    h.retrievePrice.mockResolvedValue({ ...goodPrice, unit_amount: 4900 });
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'pack_price_mismatch' });
    expect(h.create).not.toHaveBeenCalled();
  });

  it('502 when Stripe cannot be reached to read the price', async () => {
    h.retrievePrice.mockRejectedValue(new Error('network'));
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(502);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('400 invalid_request without a packId', async () => {
    const res = await POST(post({ kind: 'pack' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('retries without automatic tax when Stripe Tax is not enabled', async () => {
    h.create.mockRejectedValueOnce(new Error('Stripe Tax is not set up')).mockResolvedValueOnce({ id: 'cs_2', url: 'https://checkout.stripe.com/c/pay/cs_2' });
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(200);
    expect(h.create.mock.calls[1][0].automatic_tax).toEqual({ enabled: false });
  });
});
