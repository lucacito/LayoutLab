import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rows, updateSet, subs } = vi.hoisted(() => ({
  rows: { license: undefined as any, updated: [{ id: 'a1' }] as any[] },
  updateSet: vi.fn(),
  subs: { retrieve: vi.fn(), update: vi.fn() },
}));

vi.mock('@/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (rows.license ? [rows.license] : []) }) }) }),
    update: () => ({ set: (v: unknown) => { updateSet(v); return { where: () => ({ returning: async () => rows.updated }) }; } }),
  },
}));
vi.mock('@/lib/auth/admin', () => ({ requireUser: vi.fn(async () => ({ user: { email: 'me@x.com' } })) }));
vi.mock('@/lib/account/queries', () => ({ getUserIdByEmail: vi.fn(async (e: string) => (e === 'me@x.com' ? 'u_me' : null)) }));
vi.mock('@/lib/stripe/client', () => ({ stripe: { subscriptions: subs } }));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env, STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_AI_EDITOR_FREELANCER: 'price_f', STRIPE_PRICE_AI_EDITOR_AGENCY: 'price_a' } };
});

import { POST as changeTier } from '@/app/api/billing/change-tier/route';
import { POST as freeSite } from '@/app/api/license/free-site/route';

const req = (body: unknown) => new Request('http://t/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const lic = (over: Record<string, unknown> = {}) => ({
  id: 'l1', userId: 'u_me', productSlug: 'ai-editor-divi5-pro', tier: 'personal', status: 'active',
  lifetime: false, trial: false, stripeSubscriptionId: 'sub_1', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  rows.license = lic();
  rows.updated = [{ id: 'a1' }];
  subs.retrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
  subs.update.mockResolvedValue({});
});

describe('POST /api/billing/change-tier', () => {
  it('upgrades the subscription item to the higher tier price, prorated and invoiced now', async () => {
    const res = await changeTier(req({ licenseId: 'l1', tier: 'freelancer' }));
    expect(res.status).toBe(200);
    expect(subs.update).toHaveBeenCalledWith('sub_1', { items: [{ id: 'si_1', price: 'price_f' }], proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete' });
  });

  it.each([
    ['another user\'s licence', { userId: 'u_other' }, 'freelancer', 403],
    ['a downgrade', { tier: 'agency' }, 'freelancer', 400],
    ['the same tier', {}, 'personal', 400],
    ['a lifetime licence', { lifetime: true }, 'agency', 400],
    ['a no-card trial', { trial: true }, 'agency', 400],
    ['a cancelled licence', { status: 'canceled' }, 'agency', 400],
    ['an expired licence', { status: 'expired' }, 'agency', 400],
    ['a licence with no subscription', { stripeSubscriptionId: null }, 'agency', 400],
    ['a converter licence', { productSlug: 'elementor-to-divi5-pro', tier: null }, 'agency', 400],
  ])('refuses %s', async (_n, over, tier, status) => {
    rows.license = lic(over);
    const res = await changeTier(req({ licenseId: 'l1', tier }));
    expect(res.status).toBe(status);
    expect(subs.update).not.toHaveBeenCalled();
  });

  it('404 for an unknown licence and 400 for a bad body', async () => {
    rows.license = undefined;
    expect((await changeTier(req({ licenseId: 'nope', tier: 'agency' }))).status).toBe(404);
    expect((await changeTier(req({ licenseId: 'l1', tier: 'gold' }))).status).toBe(400);
  });
});

describe('POST /api/license/free-site', () => {
  it('deactivates one site of the user\'s own licence', async () => {
    const res = await freeSite(req({ licenseId: 'l1', siteUrl: 'a.com' }));
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith({ deactivatedAt: expect.any(Date) });
  });

  it('refuses another user\'s licence and a site that is not active', async () => {
    rows.license = lic({ userId: 'u_other' });
    expect((await freeSite(req({ licenseId: 'l1', siteUrl: 'a.com' }))).status).toBe(403);
    rows.license = lic();
    rows.updated = [];
    expect((await freeSite(req({ licenseId: 'l1', siteUrl: 'a.com' }))).status).toBe(404);
  });
});
