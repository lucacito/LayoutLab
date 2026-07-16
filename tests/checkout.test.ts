import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCheckoutSessionParams } from '@/lib/stripe/checkout';

// Real `stripe` client requires a live SDK call — mock it so the ai-editor
// price-selection tests below can assert on what checkout.sessions.create was
// called with, without hitting the network.
vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));

// `env` is an eagerly-parsed module-level singleton (see lib/env.ts); mock it
// as a mutable copy of the real (test-config) values so individual tests can
// flip STRIPE_PRICE_AI_EDITOR_PRO on/off without touching process.env.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env } };
});

import { POST } from '@/app/api/checkout/route';
import { stripe } from '@/lib/stripe/client';
import { env as mockEnv } from '@/lib/env';

const ctx = { siteUrl: 'https://divi5lab.com', automaticTax: true };

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

  it('always discloses the no-refund / instant-delivery policy at checkout with a link to /license', () => {
    const p = buildCheckoutSessionParams({ kind: 'pack', packId: 'pk1' }, { ...ctx, packPriceId: 'price_pack' });
    const msg = (p.custom_text as any)?.submit?.message as string;
    expect(msg).toBeTruthy();
    expect(msg.toLowerCase()).toContain('final');
    expect(msg).toContain('https://divi5lab.com/license');
    // Message must respect Stripe's 1200-char limit on custom_text fields.
    expect(msg.length).toBeLessThanOrEqual(1200);
  });

  it('does NOT require a terms-of-service checkbox by default (dashboard ToS URL not assumed)', () => {
    const p = buildCheckoutSessionParams({ kind: 'pack', packId: 'pk1' }, { ...ctx, packPriceId: 'price_pack' });
    expect(p.consent_collection).toBeUndefined();
  });

  it('collects an express withdrawal-waiver consent when requireTermsConsent is set (EU/UK compliance)', () => {
    const p = buildCheckoutSessionParams(
      { kind: 'pack', packId: 'pk1' },
      { ...ctx, packPriceId: 'price_pack', requireTermsConsent: true },
    );
    expect((p.consent_collection as any)?.terms_of_service).toBe('required');
    const tos = (p.custom_text as any)?.terms_of_service_acceptance?.message as string;
    expect(tos).toBeTruthy();
    expect(tos.toLowerCase()).toContain('immediate');
    expect(tos.length).toBeLessThanOrEqual(1200);
  });
});

describe('plugin license checkout', () => {
  const ctx = {
    siteUrl: 'https://divi5lab.com',
    pluginPriceId: 'price_pro_yearly',
    automaticTax: true,
  };
  it('builds a subscription session with plugin metadata on session AND subscription', () => {
    const params = buildCheckoutSessionParams(
      { kind: 'plugin', product: 'elementor-to-divi5-pro' }, ctx,
    );
    expect(params.mode).toBe('subscription');
    expect(params.line_items).toEqual([{ price: 'price_pro_yearly', quantity: 1 }]);
    expect(params.metadata).toEqual({ kind: 'plugin', product: 'elementor-to-divi5-pro' });
    expect((params.subscription_data as any).metadata).toEqual({ kind: 'plugin', product: 'elementor-to-divi5-pro' });
    // The launch trial is scoped to the AI Editor only — other plugins pay now.
    expect((params.subscription_data as any).trial_period_days).toBeUndefined();
    expect(params.payment_method_collection).toBeUndefined();
  });

  it('plugin checkout sessions allow promotion codes', () => {
    const params = buildCheckoutSessionParams(
      { kind: 'plugin', product: 'ai-editor-divi5-pro' },
      { siteUrl: 'https://divi5lab.com', pluginPriceId: 'price_x', automaticTax: true },
    );
    expect(params.allow_promotion_codes).toBe(true);
    expect(params.mode).toBe('subscription');
  });

  // Launch offer: every plugin subscription starts with a 45-day free trial, and
  // Checkout must NOT collect a card up front (`if_required`). Because no payment
  // method is on file, the trial can't silently auto-charge — it ends by cancelling
  // (missing_payment_method: 'cancel') so no tester is ever hit with a surprise
  // invoice. The webhook mints the license on session.completed regardless of $0 due.
  it('starts a 45-day free trial with no card required, cancelling at trial end', () => {
    const params = buildCheckoutSessionParams(
      { kind: 'plugin', product: 'ai-editor-divi5-pro' },
      { siteUrl: 'https://divi5lab.com', pluginPriceId: 'price_x', automaticTax: true },
    );
    expect(params.payment_method_collection).toBe('if_required');
    const subData = params.subscription_data as any;
    expect(subData.trial_period_days).toBe(45);
    expect(subData.trial_settings.end_behavior.missing_payment_method).toBe('cancel');
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
  // Marketplace demotion (Task 6): the store is plugin-checkout-only now. `pack`
  // and `membership` are no longer accepted shapes — they 400 as `invalid_request`
  // just like any other malformed body, never as a domain-specific error.
  it('400 invalid_request on {kind:"pack",packId} — packs are no longer purchasable', async () => {
    const res = await POST(post({ kind: 'pack', packId: 'pk1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });
  it('400 invalid_request on {kind:"membership",plan} — membership is no longer purchasable', async () => {
    const res = await POST(post({ kind: 'membership', plan: 'monthly' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });
});

describe('POST /api/checkout — ai-editor-divi5-pro (plugin, subscription)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (mockEnv as Record<string, unknown>).STRIPE_PRICE_AI_EDITOR_PRO;
  });

  it('accepts kind=plugin product=ai-editor-divi5-pro and uses STRIPE_PRICE_AI_EDITOR_PRO', async () => {
    mockEnv.STRIPE_PRICE_AI_EDITOR_PRO = 'price_aied_test';
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test',
    } as never);

    const res = await POST(post({ kind: 'plugin', product: 'ai-editor-divi5-pro' }));

    expect(res.status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0]![0] as { line_items: Array<{ price: string }> };
    expect(params.line_items[0]!.price).toBe('price_aied_test');
  });

  it('returns plugin_unavailable when STRIPE_PRICE_AI_EDITOR_PRO is unset', async () => {
    const res = await POST(post({ kind: 'plugin', product: 'ai-editor-divi5-pro' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'plugin_unavailable' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
