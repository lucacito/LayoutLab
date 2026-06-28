import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/admin', () => ({
  requireUser: vi.fn(async () => ({ user: { email: 'buyer@example.com' } })),
}));

vi.mock('@/lib/account/queries', () => ({
  getStripeCustomerIdByEmail: vi.fn(async () => null as string | null),
}));

import { POST } from '@/app/api/billing/portal/route';

describe('POST /api/billing/portal', () => {
  it('400 when the user has no Stripe customer', async () => {
    const res = await POST(new Request('http://test/api/billing/portal', { method: 'POST' }));
    expect(res.status).toBe(400);
  });
});
