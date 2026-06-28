import { describe, it, expect } from 'vitest';
import { isAdmin } from '@/lib/auth/config';

describe('isAdmin', () => {
  it('is true for an admin session', () => {
    expect(isAdmin({ user: { role: 'admin' } } as any)).toBe(true);
  });
  it('is false for a normal user or no session', () => {
    expect(isAdmin({ user: { role: 'user' } } as any)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
