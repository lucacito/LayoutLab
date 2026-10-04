import { describe, it, expect, vi, beforeEach } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
const { state, sendEmail, retrieve } = vi.hoisted(() => ({
  state: { log: [] as string[], candidates: [] as any[], recorded: [] as any[], claimRows: [{ days: 7 }] as any[], user: [{ email: 'buyer@x.com' }] as any[] },
  sendEmail: vi.fn(),
  retrieve: vi.fn(),
}));

// A tiny query-builder fake: each call is logged so the ORDER (claim before send, release after a failed send) is checkable.
vi.mock('@/db/client', () => {
  const chain = (kind: string, rows: () => any) => {
    const c: any = {
      from: () => c, where: () => c, limit: () => c, values: () => c, onConflictDoNothing: () => c,
      returning: async () => { state.log.push(`${kind}:returning`); return rows(); },
      then: (res: any, rej: any) => Promise.resolve(rows()).then(res, rej),
    };
    return c;
  };
  return {
    db: {
      select: (cols?: any) => {
        if (cols && 'days' in cols) return chain('select-recorded', () => state.recorded);
        if (cols && 'email' in cols) return chain('select-user', () => state.user);
        return chain('select-candidates', () => state.candidates);
      },
      insert: () => chain('claim', () => state.claimRows),
      delete: () => chain('release', () => { state.log.push('release'); return []; }),
    },
  };
});
vi.mock('@/lib/email', () => ({ sendEmail }));
vi.mock('@/lib/stripe/client', () => ({ stripe: { subscriptions: { retrieve } } }));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env, CRON_SECRET: 's3', NEXT_PUBLIC_SITE_URL: 'https://divi5lab.com' } };
});

import { GET } from '@/app/api/cron/renewal-reminders/route';
import { PRICING } from '@/lib/pricing/config';

const lic = (over: Record<string, unknown> = {}) => ({
  id: 'l1', userId: 'u1', productSlug: PRICING.product, licenseKey: 'K', status: 'active', tier: 'personal',
  founding: false, lifetime: false, trial: false, stripeSubscriptionId: 'sub_1',
  currentPeriodEnd: new Date(Date.now() + 5 * DAY), ...over,
});
const run = () => GET(new Request('http://t/c', { headers: { authorization: 'Bearer s3' } }));

beforeEach(() => {
  vi.clearAllMocks();
  state.log = [];
  state.candidates = [lic()];
  state.recorded = [];
  state.claimRows = [{ days: 7 }];
  state.user = [{ email: 'buyer@x.com' }];
  retrieve.mockResolvedValue({ status: 'active', cancel_at_period_end: false, cancel_at: null });
  sendEmail.mockImplementation(async () => { state.log.push('send'); return { sent: true }; });
});

describe('renewal reminder run', () => {
  it('claims the reminder BEFORE it sends, and points the email at the billing page', async () => {
    const res = await (await run()).json();
    expect(res).toEqual({ ok: true, checked: 1, sent: 1, failed: 0 });
    expect(state.log.indexOf('claim:returning')).toBeGreaterThanOrEqual(0);
    expect(state.log.indexOf('claim:returning')).toBeLessThan(state.log.indexOf('send'));
    expect(sendEmail.mock.calls[0]![0].text).toContain(`https://divi5lab.com${PRICING.urls.billing}`);
  });

  it('does not send when another run already claimed it', async () => {
    state.claimRows = [];
    const res = await (await run()).json();
    expect(res.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('a subscription the customer has cancelled gets no renews-on email', async () => {
    retrieve.mockResolvedValue({ status: 'active', cancel_at_period_end: true, cancel_at: null });
    const res = await (await run()).json();
    expect(res).toMatchObject({ sent: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.log).not.toContain('release');
  });

  it('a failed send releases the claim so the next run retries', async () => {
    sendEmail.mockResolvedValue({ sent: false });
    const res = await (await run()).json();
    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect(state.log).toContain('release');
  });

  it('a Stripe read failure releases the claim and sends nothing', async () => {
    retrieve.mockRejectedValue(new Error('stripe down'));
    const res = await (await run()).json();
    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.log).toContain('release');
  });

  it('a licence with no subscription id is never emailed', async () => {
    state.candidates = [lic({ stripeSubscriptionId: null })];
    const res = await (await run()).json();
    expect(res.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
