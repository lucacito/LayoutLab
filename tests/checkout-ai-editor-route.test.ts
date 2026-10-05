import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));
vi.mock('@/lib/stripe/client', () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock('@/lib/stripe/fulfillment-store', () => ({ dbStore: { countLicensesByCondition: vi.fn() } }));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env } };
});
vi.mock('@/lib/site/pro-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/site/pro-status')>();
  return { ...actual, isProductPaused: vi.fn(() => false) };
});

import { POST } from '@/app/api/checkout/route';
import { stripe } from '@/lib/stripe/client';
import { dbStore } from '@/lib/stripe/fulfillment-store';
import { env } from '@/lib/env';
import { PRICING } from '@/lib/pricing/config';
import { rateLimit } from '@/lib/rate-limit';

const create = vi.mocked(stripe.checkout.sessions.create);
const count = vi.mocked(dbStore.countLicensesByCondition);
const post = (body: unknown) => POST(new Request('http://t/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const base = { kind: 'plugin', product: 'ai-editor-divi5-pro' };
const ok = { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  const e = env as Record<string, string | undefined>;
  e.STRIPE_SECRET_KEY = 'sk_test';
  e.STRIPE_PRICE_AI_EDITOR_PERSONAL = 'price_personal';
  e.STRIPE_PRICE_AI_EDITOR_FREELANCER = 'price_freelancer';
  e.STRIPE_PRICE_AI_EDITOR_AGENCY = 'price_agency';
  e.STRIPE_PRICE_AI_EDITOR_LIFETIME = 'price_lifetime';
  e.STRIPE_COUPON_AI_EDITOR_FOUNDING = 'co_founding';
  count.mockResolvedValue(0);
  create.mockResolvedValue(ok);
});

describe('POST /api/checkout for the AI Editor', () => {
  it('needs a tier or lifetime', async () => {
    expect((await post(base)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('sells each tier at its own price', async () => {
    for (const [tier, price] of [['personal', 'price_personal'], ['freelancer', 'price_freelancer'], ['agency', 'price_agency']] as const) {
      create.mockClear();
      expect((await post({ ...base, tier })).status).toBe(200);
      expect((create.mock.calls[0]![0] as any).line_items[0].price).toBe(price);
    }
  });

  it('plugin_unavailable when that tier has no Stripe price configured', async () => {
    (env as Record<string, string | undefined>).STRIPE_PRICE_AI_EDITOR_AGENCY = undefined;
    const res = await post({ ...base, tier: 'agency' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'plugin_unavailable' });
  });

  it('a trial is only valid on the trial tier, and never sends the founding coupon', async () => {
    expect((await post({ ...base, tier: 'agency', trial: true })).status).toBe(400);
    expect((await post({ ...base, tier: PRICING.trial.tier, trial: true })).status).toBe(200);
    const params = create.mock.calls[0]![0] as any;
    expect(params.discounts).toBeUndefined();
    expect(params.subscription_data.trial_period_days).toBe(PRICING.trial.days);
    expect(count).not.toHaveBeenCalled();
  });

  it('applies the founding coupon while fewer than the cap are taken, and not at the cap', async () => {
    count.mockResolvedValue(PRICING.founding.cap - 1);
    await post({ ...base, tier: 'personal' });
    expect((create.mock.calls[0]![0] as any).discounts).toEqual([{ coupon: 'co_founding' }]);

    create.mockClear();
    count.mockResolvedValue(PRICING.founding.cap);
    await post({ ...base, tier: 'personal' });
    expect((create.mock.calls[0]![0] as any).discounts).toBeUndefined();
    expect((create.mock.calls[0]![0] as any).metadata.founding).toBe('0');
  });

  it('no coupon configured means no founding discount and no count query', async () => {
    (env as Record<string, string | undefined>).STRIPE_COUPON_AI_EDITOR_FOUNDING = undefined;
    await post({ ...base, tier: 'personal' });
    expect((create.mock.calls[0]![0] as any).discounts).toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });

  it('a refused coupon never blocks the purchase: it retries without it', async () => {
    create.mockRejectedValueOnce(new Error('This coupon has reached its maximum redemptions')).mockResolvedValueOnce(ok);
    const res = await post({ ...base, tier: 'personal' });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
    const retry = create.mock.calls[1]![0] as any;
    expect(retry.discounts).toBeUndefined();
    expect(retry.metadata.founding).toBe('0');
  });

  it('a coupon failure followed by a tax failure still ends in a session', async () => {
    create.mockRejectedValueOnce(new Error('invalid coupon')).mockRejectedValueOnce(new Error('automatic tax is not enabled')).mockResolvedValueOnce(ok);
    expect((await post({ ...base, tier: 'personal' })).status).toBe(200);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('an unrelated Stripe failure is a clean 502', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    expect((await post({ ...base, tier: 'personal' })).status).toBe(502);
  });

  it('lifetime: one-time price, tier unset in the request, sold out at the cap', async () => {
    expect((await post({ ...base, lifetime: true, tier: 'agency' })).status).toBe(400);
    count.mockResolvedValue(PRICING.lifetime.cap - 1);
    expect((await post({ ...base, lifetime: true })).status).toBe(200);
    expect((create.mock.calls[0]![0] as any).mode).toBe('payment');
    expect((create.mock.calls[0]![0] as any).line_items[0].price).toBe('price_lifetime');

    create.mockClear();
    count.mockResolvedValue(PRICING.lifetime.cap);
    const res = await post({ ...base, lifetime: true });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: 'sold_out' });
    expect(create).not.toHaveBeenCalled();
  });

  describe('lifetime and the founding offer', () => {
    // The lifetime and founding counters are separate queries; answer each by its condition.
    const counts = (c: { lifetime: number; founding: number }) =>
      count.mockImplementation(async (cond) => ((cond as { lifetime?: boolean }).lifetime ? c.lifetime : c.founding));

    it('applies the founding coupon to lifetime while founding places are left', async () => {
      counts({ lifetime: 3, founding: PRICING.founding.cap - 1 });
      expect((await post({ ...base, lifetime: true })).status).toBe(200);
      const params = create.mock.calls[0]![0] as any;
      expect(params.mode).toBe('payment');
      expect(params.line_items[0].price).toBe('price_lifetime');
      expect(params.discounts).toEqual([{ coupon: 'co_founding' }]);
      expect(params.metadata).toMatchObject({ lifetime: '1', founding: '1' });
    });

    it('is full price once the founding places are used up, while lifetime is still on sale', async () => {
      counts({ lifetime: 3, founding: PRICING.founding.cap });
      expect((await post({ ...base, lifetime: true })).status).toBe(200);
      const params = create.mock.calls[0]![0] as any;
      expect(params.discounts).toBeUndefined();
      expect(params.metadata).toMatchObject({ lifetime: '1', founding: '0' });
    });

    it('is full price when no founding coupon is configured, and never queries the founding count', async () => {
      (env as Record<string, string | undefined>).STRIPE_COUPON_AI_EDITOR_FOUNDING = undefined;
      counts({ lifetime: 3, founding: 0 });
      expect((await post({ ...base, lifetime: true })).status).toBe(200);
      expect((create.mock.calls[0]![0] as any).discounts).toBeUndefined();
      expect(count).toHaveBeenCalledTimes(1);
    });

    it('a refused coupon never blocks a lifetime purchase: it retries at full price', async () => {
      counts({ lifetime: 3, founding: 0 });
      create.mockRejectedValueOnce(new Error('This coupon cannot be applied')).mockResolvedValueOnce(ok);
      expect((await post({ ...base, lifetime: true })).status).toBe(200);
      const retry = create.mock.calls[1]![0] as any;
      expect(retry.mode).toBe('payment');
      expect(retry.discounts).toBeUndefined();
      expect(retry.metadata).toMatchObject({ lifetime: '1', founding: '0' });
    });

    it('is still sold out at the lifetime cap even when founding places are left', async () => {
      counts({ lifetime: PRICING.lifetime.cap, founding: 0 });
      expect((await post({ ...base, lifetime: true })).status).toBe(410);
      expect(create).not.toHaveBeenCalled();
    });
  });

  it('429 when one address starts too many checkouts, before any Stripe or DB call', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false } as never);
    const res = await post({ ...base, tier: 'personal', trial: true });
    expect(res.status).toBe(429);
    expect(create).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});

describe('a Stripe price variable that holds a label instead of a price id', () => {
  it('is treated as not configured: plugin_unavailable, no call to Stripe', async () => {
    (env as Record<string, string | undefined>).STRIPE_PRICE_AI_EDITOR_PERSONAL = '$49.00 per year';
    const res = await post({ ...base, tier: 'personal', trial: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'plugin_unavailable' });
    expect(create).not.toHaveBeenCalled();
  });

  it('the same for lifetime', async () => {
    (env as Record<string, string | undefined>).STRIPE_PRICE_AI_EDITOR_LIFETIME = '$449.00';
    const res = await post({ ...base, lifetime: true });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('a malformed founding coupon id is ignored, never sent', async () => {
    (env as Record<string, string | undefined>).STRIPE_COUPON_AI_EDITOR_FOUNDING = '30% off (forever)';
    await post({ ...base, tier: 'personal' });
    expect((create.mock.calls[0]![0] as any).discounts).toBeUndefined();
  });
});
