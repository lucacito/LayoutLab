import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureFreePack, rateLimit, CaptureError } = vi.hoisted(() => {
  class CaptureError extends Error { code = 'not_free' as const; constructor() { super('not_free'); } }
  return {
    captureFreePack: vi.fn(),
    rateLimit: vi.fn(() => ({ ok: true, remaining: 4 })),
    CaptureError,
  };
});

vi.mock('@/lib/capture/capture', () => ({ captureFreePack, CaptureError }));
vi.mock('@/lib/capture/store', () => ({ captureDeps: {} }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit }));

import { POST } from '@/app/api/capture/route';

const req = (body: unknown) =>
  new Request('http://test/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  captureFreePack.mockReset();
  rateLimit.mockReturnValue({ ok: true, remaining: 4 });
});

describe('POST /api/capture', () => {
  it('400 on a bad body', async () => {
    const res = await POST(req({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(captureFreePack).not.toHaveBeenCalled();
  });

  it('429 when rate-limited', async () => {
    rateLimit.mockReturnValue({ ok: false, remaining: 0 });
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(429);
    expect(captureFreePack).not.toHaveBeenCalled();
  });

  it('422 for a non-free pack', async () => {
    captureFreePack.mockRejectedValue(new CaptureError());
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(422);
  });

  it('200 ok on success', async () => {
    captureFreePack.mockResolvedValue({ ok: true, email: 'a@b.c' });
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
