import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted so the mock var is available to the hoisted vi.mock factory
// (project pattern — bare top-level vars trip Vitest's hoisting guard).
const { create } = vi.hoisted(() => ({ create: vi.fn(async () => ({ data: { id: 'eml_1' }, error: null })) }));
vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: create } })) }));

const ORIG = { ...process.env };
beforeEach(() => { create.mockClear(); });
afterEach(() => { process.env = { ...ORIG }; vi.unstubAllGlobals(); });

describe('magicLinkEmail', () => {
  it('includes the url in html and text', async () => {
    const { magicLinkEmail } = await import('@/lib/email/magic-link');
    const m = magicLinkEmail('https://layoutlab.com/api/auth/callback/email?token=abc');
    expect(m.subject).toMatch(/sign in/i);
    expect(m.html).toContain('https://layoutlab.com/api/auth/callback/email?token=abc');
    expect(m.text).toContain('https://layoutlab.com/api/auth/callback/email?token=abc');
  });
});

describe('sendEmail', () => {
  it('without RESEND_API_KEY: logs, does not throw, returns { sent: false }', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await import('@/lib/email/resend');
    const res = await sendEmail({ to: 'a@b.c', subject: 'S', html: '<p>hi</p>' });
    expect(res).toEqual({ sent: false });
    expect(log).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('with RESEND_API_KEY: sends via Resend and returns { sent: true }', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'LayoutLab <noreply@layoutlab.com>';
    vi.resetModules();
    const { sendEmail } = await import('@/lib/email/resend');
    const res = await sendEmail({ to: 'a@b.c', subject: 'S', html: '<p>hi</p>', text: 'hi' });
    expect(res).toEqual({ sent: true });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'LayoutLab <noreply@layoutlab.com>', to: 'a@b.c', subject: 'S', html: '<p>hi</p>' }),
    );
  });
});
