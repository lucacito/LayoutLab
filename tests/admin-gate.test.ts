import { describe, it, expect, vi } from 'vitest';

// Mock next-auth and next/navigation so the pure adminGateDecision function
// can be tested in isolation without the edge/server runtime dependencies.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { adminGateDecision } from '@/lib/auth/admin';

describe('adminGateDecision', () => {
  it('ok for an admin session', () => {
    expect(adminGateDecision({ user: { role: 'admin' } } as any)).toBe('ok');
  });
  it('forbidden for a signed-in non-admin', () => {
    expect(adminGateDecision({ user: { role: 'user' } } as any)).toBe('forbidden');
  });
  it('unauthenticated for no session / no user', () => {
    expect(adminGateDecision(null)).toBe('unauthenticated');
    expect(adminGateDecision({} as any)).toBe('unauthenticated');
  });
});
