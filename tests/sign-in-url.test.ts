import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

const ORIG = { ...process.env };
beforeEach(() => { process.env.AUTH_SECRET = 'test-secret-test-secret-32chars!!'; process.env.NEXT_PUBLIC_SITE_URL = 'https://layoutlab.com'; });
afterEach(() => { process.env = { ...ORIG }; });

describe('createMagicSignInUrl', () => {
  it('stores SHA-256(token+secret) and returns the Auth.js callback URL with the raw token', async () => {
    const { createMagicSignInUrl } = await import('@/lib/auth/sign-in-url');
    let stored: { identifier: string; hashedToken: string; expires: Date } | null = null;
    const deps = {
      storeToken: async (identifier: string, hashedToken: string, expires: Date) => { stored = { identifier, hashedToken, expires }; },
      now: () => new Date('2026-06-28T00:00:00Z'),
    };
    const url = await createMagicSignInUrl('  Buyer@Example.COM ', '/account/downloads', deps);

    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://layoutlab.com/api/auth/callback/email');
    expect(u.searchParams.get('callbackUrl')).toBe('https://layoutlab.com/account/downloads');
    expect(u.searchParams.get('email')).toBe('buyer@example.com');
    const rawToken = u.searchParams.get('token')!;
    expect(rawToken.length).toBeGreaterThan(20);

    // stored hash must equal SHA-256(rawToken + secret), identifier normalized, +24h expiry
    expect(stored!.identifier).toBe('buyer@example.com');
    expect(stored!.hashedToken).toBe(createHash('sha256').update(`${rawToken}${process.env.AUTH_SECRET}`).digest('hex'));
    expect(stored!.expires.getTime()).toBe(new Date('2026-06-29T00:00:00Z').getTime());
  });

  it('throws if AUTH_SECRET is unset', async () => {
    delete process.env.AUTH_SECRET;
    const { createMagicSignInUrl } = await import('@/lib/auth/sign-in-url');
    await expect(createMagicSignInUrl('a@b.com', '/x', { storeToken: async () => {}, now: () => new Date() })).rejects.toThrow();
  });
});
