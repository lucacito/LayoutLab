import { describe, it, expect, vi } from 'vitest';

// Mock next-auth and next/navigation so the pure userGateDecision function
// can be tested in isolation without the edge/server runtime dependencies.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { userGateDecision } from '@/lib/auth/admin';

describe('userGateDecision', () => {
  it('ok for any signed-in user', () => {
    expect(userGateDecision({ user: { email: 'a@b.c' } } as any)).toBe('ok');
  });
  it('unauthenticated for no session / no user', () => {
    expect(userGateDecision(null)).toBe('unauthenticated');
    expect(userGateDecision({} as any)).toBe('unauthenticated');
  });
});
