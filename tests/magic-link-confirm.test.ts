import { describe, it, expect, vi, beforeEach } from 'vitest';

const AUTHJS_URL =
  'https://divi5lab.com/api/auth/callback/email?callbackUrl=https%3A%2F%2Fdivi5lab.com%2Faccount&token=abc123&email=sue%40example.com';

describe('toConfirmUrl', () => {
  it('points the emailed link at the confirm page, not the token-consuming callback', async () => {
    const { toConfirmUrl } = await import('@/lib/auth/confirm-link');
    const u = new URL(toConfirmUrl(AUTHJS_URL));
    expect(u.origin + u.pathname).toBe('https://divi5lab.com/auth/confirm');
    expect(u.searchParams.get('token')).toBe('abc123');
    expect(u.searchParams.get('email')).toBe('sue@example.com');
    expect(u.searchParams.get('callbackUrl')).toBe('https://divi5lab.com/account');
  });
});

describe('callbackUrlFor', () => {
  it('rebuilds the Auth.js callback URL on our own origin', async () => {
    const { callbackUrlFor } = await import('@/lib/auth/confirm-link');
    const u = new URL(callbackUrlFor('https://divi5lab.com', { token: 't', email: 'a@b.com', callbackUrl: 'https://divi5lab.com/account/licenses' }));
    expect(u.origin + u.pathname).toBe('https://divi5lab.com/api/auth/callback/email');
    expect(u.searchParams.get('token')).toBe('t');
    expect(u.searchParams.get('email')).toBe('a@b.com');
    expect(u.searchParams.get('callbackUrl')).toBe('https://divi5lab.com/account/licenses');
  });

  it('replaces a callbackUrl on another origin with /account (no open redirect)', async () => {
    const { callbackUrlFor } = await import('@/lib/auth/confirm-link');
    const u = new URL(callbackUrlFor('https://divi5lab.com', { token: 't', email: 'a@b.com', callbackUrl: 'https://evil.example/phish' }));
    expect(u.searchParams.get('callbackUrl')).toBe('https://divi5lab.com/account');
  });

  it('defaults a missing callbackUrl to /account', async () => {
    const { callbackUrlFor } = await import('@/lib/auth/confirm-link');
    const u = new URL(callbackUrlFor('https://divi5lab.com', { token: 't', email: 'a@b.com' }));
    expect(u.searchParams.get('callbackUrl')).toBe('https://divi5lab.com/account');
  });
});

describe('POST /api/magic-link/continue', () => {
  beforeEach(() => { vi.resetModules(); });

  it('answers a form POST with a 303 to the Auth.js callback carrying the token', async () => {
    const { POST } = await import('@/app/api/magic-link/continue/route');
    const body = new URLSearchParams({ token: 'abc123', email: 'sue@example.com', callbackUrl: 'https://divi5lab.com/account' });
    const res = await POST(new Request('https://divi5lab.com/api/magic-link/continue', { method: 'POST', body }));
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/api/auth/callback/email');
    expect(loc.searchParams.get('token')).toBe('abc123');
  });

  it('sends a POST without a token back to /login instead of the callback', async () => {
    const { POST } = await import('@/app/api/magic-link/continue/route');
    const res = await POST(new Request('https://divi5lab.com/api/magic-link/continue', { method: 'POST', body: new URLSearchParams({ email: 'a@b.com' }) }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });
});

describe('Auth.js route HEAD guard', () => {
  it('answers HEAD without invoking the Auth.js GET handler (which would consume the token)', async () => {
    vi.resetModules();
    const get = vi.fn();
    vi.doMock('@/lib/auth', () => ({ handlers: { GET: get, POST: vi.fn() } }));
    const route = await import('@/app/api/auth/[...nextauth]/route');
    const res = await route.HEAD();
    expect(res.status).toBe(200);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('sendMagicLink', () => {
  it('emails the confirm-page link, never the raw token-consuming callback URL', async () => {
    vi.resetModules();
    const sendEmail = vi.fn(async () => ({ sent: true }));
    vi.doMock('@/lib/email/resend', () => ({ sendEmail }));
    const { sendMagicLink } = await import('@/lib/email');
    await sendMagicLink('sue@example.com', AUTHJS_URL);
    const mail = (sendEmail.mock.calls[0] as unknown as [{ html: string; text: string }])[0];
    expect(mail.html).toContain('https://divi5lab.com/auth/confirm?');
    expect(mail.text).toContain('https://divi5lab.com/auth/confirm?');
    expect(mail.html).not.toContain('/api/auth/callback/email');
    expect(mail.text).not.toContain('/api/auth/callback/email');
  });
});
