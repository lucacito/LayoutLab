// tests/download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readCaptureEmail: vi.fn(async () => null as string | null),
  auth: vi.fn(async () => null as { user?: { email?: string } } | null),
  getLayoutForDownload: vi.fn(async () => ({ id: 'l1', slug: 'bold-saas-hero', diviJsonBlobKey: 'pipeline/out/x.json' })),
  getUserIdByEmail: vi.fn(async () => 'u1'),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async (): Promise<Buffer | null> => Buffer.from('{"content":[]}')),
  rateLimit: vi.fn(() => ({ ok: true, remaining: 39 })),
}));

vi.mock('@/lib/capture/cookie', () => ({ readCaptureEmail: h.readCaptureEmail }));
vi.mock('@/lib/auth', () => ({ auth: h.auth }));
vi.mock('@/lib/account/queries', () => ({ getLayoutForDownload: h.getLayoutForDownload, getUserIdByEmail: h.getUserIdByEmail, recordDownload: h.recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset: h.fetchAsset }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));

import { GET } from '@/app/api/download/[layoutId]/route';
const ctx = (id: string) => ({ params: Promise.resolve({ layoutId: id }) });
const req = () => new Request('http://test/api/download/l1');

beforeEach(() => {
  h.readCaptureEmail.mockResolvedValue(null);
  h.auth.mockResolvedValue(null);
  h.fetchAsset.mockResolvedValue(Buffer.from('{"content":[]}'));
  h.rateLimit.mockReturnValue({ ok: true, remaining: 39 });
  h.recordDownload.mockClear();
});

describe('GET /api/download/[layoutId]', () => {
  it('403 email_required when neither a capture cookie nor a session', async () => {
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(403);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });

  it('200 zip when a valid capture cookie is present (anonymous)', async () => {
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('bold-saas-hero.zip');
    expect(h.recordDownload).toHaveBeenCalled();
  });

  it('200 zip when signed in without a cookie', async () => {
    h.auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
  });

  it('429 when rate-limited (no download)', async () => {
    h.rateLimit.mockReturnValue({ ok: false, remaining: 0 });
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(429);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });

  it('404 when the asset is unavailable (entitled by cookie)', async () => {
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    h.fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(404);
  });

  it('still delivers the zip (200) when the download-audit write fails — logging is best-effort', async () => {
    // Regression: a prod DB missing the downloads.email column made recordDownload
    // throw, turning a valid free download into a 500. Audit logging must never
    // break the actual download.
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    h.recordDownload.mockRejectedValueOnce(new Error('column "email" does not exist'));
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
  });
});
