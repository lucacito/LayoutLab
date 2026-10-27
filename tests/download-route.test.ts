// tests/download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readCaptureEmail: vi.fn(async () => null as string | null),
  auth: vi.fn(async () => null as { user?: { email?: string } } | null),
  getLayoutForDownload: vi.fn(async () => ({ id: 'l1', slug: 'bold-saas-hero', diviJsonBlobKey: 'pipeline/out/x.json' })),
  getUserIdByEmail: vi.fn(async () => 'u1' as string | null),
  getLayoutPackContext: vi.fn(async () => ({ packIds: [] as string[], packKindById: {} as Record<string, 'free' | 'paid'> })),
  getEntitlementsForUser: vi.fn(async () => [] as { scope: string; source: string; expiresAt: Date | null }[]),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async (): Promise<Buffer | null> => Buffer.from('{"content":[]}')),
  rateLimit: vi.fn(() => ({ ok: true, remaining: 39 })),
}));

vi.mock('@/lib/capture/cookie', () => ({ readCaptureEmail: h.readCaptureEmail }));
vi.mock('@/lib/auth', () => ({ auth: h.auth }));
vi.mock('@/lib/account/queries', () => ({
  getLayoutForDownload: h.getLayoutForDownload,
  getUserIdByEmail: h.getUserIdByEmail,
  getLayoutPackContext: h.getLayoutPackContext,
  getEntitlementsForUser: h.getEntitlementsForUser,
  recordDownload: h.recordDownload,
}));
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
  h.getLayoutPackContext.mockResolvedValue({ packIds: [], packKindById: {} });
  h.getEntitlementsForUser.mockResolvedValue([]);
  h.getUserIdByEmail.mockResolvedValue('u1');
});

// Free layouts need only a captured email or a session; layouts that live only in paid packs need the pack.
describe('GET /api/download/[layoutId]', () => {
  it('403 capture_required when neither a capture cookie nor a session', async () => {
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'capture_required' });
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

  // A layout that lives only inside paid packs is sold with the pack: a captured email is not enough.
  describe('a layout that belongs only to paid packs', () => {
    beforeEach(() => {
      h.getLayoutPackContext.mockResolvedValue({ packIds: ['pk1'], packKindById: { pk1: 'paid' } });
    });
    it('403 forbidden with just a captured email', async () => {
      h.readCaptureEmail.mockResolvedValue('a@b.com');
      const res = await GET(req(), ctx('l1'));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
      expect(h.recordDownload).not.toHaveBeenCalled();
    });
    it('403 forbidden when signed in without owning the pack', async () => {
      h.auth.mockResolvedValue({ user: { email: 'u@x.com' } });
      const res = await GET(req(), ctx('l1'));
      expect(res.status).toBe(403);
    });
    it('403 forbidden for an anonymous visitor', async () => {
      expect((await GET(req(), ctx('l1'))).status).toBe(403);
    });
    it('200 zip when the signed-in buyer owns the pack', async () => {
      h.auth.mockResolvedValue({ user: { email: 'u@x.com' } });
      h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:pk1', source: 'order', expiresAt: null }]);
      const res = await GET(req(), ctx('l1'));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/zip');
    });
    it('403 when the buyer owns a different pack', async () => {
      h.auth.mockResolvedValue({ user: { email: 'u@x.com' } });
      h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:other', source: 'order', expiresAt: null }]);
      expect((await GET(req(), ctx('l1'))).status).toBe(403);
    });
    it('a captured email never unlocks it even when the same email owns the pack but is not signed in', async () => {
      h.readCaptureEmail.mockResolvedValue('buyer@x.com');
      h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:pk1', source: 'order', expiresAt: null }]);
      expect((await GET(req(), ctx('l1'))).status).toBe(403);
    });
  });

  it('a layout in a paid pack that is also in a free pack stays a free lead magnet (captured email is enough)', async () => {
    h.getLayoutPackContext.mockResolvedValue({ packIds: ['pk1', 'pk2'], packKindById: { pk1: 'paid', pk2: 'free' } });
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    expect((await GET(req(), ctx('l1'))).status).toBe(200);
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
