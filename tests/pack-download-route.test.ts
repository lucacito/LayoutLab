// tests/pack-download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const h = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ user: { email: 'buyer@x.com' } })),
  getUserIdByEmail: vi.fn(async () => 'u1'),
  getEntitlementsForUser: vi.fn(async () => [] as any[]),
  getPackForDownload: vi.fn(async (): Promise<{ id: string; slug: string } | null> => ({ id: 'p1', slug: 'agency-essentials' })),
  getPackLayoutsForDownload: vi.fn(async () => [{ id: 'l1', slug: 'a-hero', diviJsonBlobKey: 'k1' }, { id: 'l2', slug: 'b-cta', diviJsonBlobKey: 'k2' }]),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async (): Promise<Buffer | null> => Buffer.from('{"x":1}')),
}));
vi.mock('@/lib/auth/admin', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/account/queries', () => ({ getUserIdByEmail: h.getUserIdByEmail, getEntitlementsForUser: h.getEntitlementsForUser, getPackForDownload: h.getPackForDownload, getPackLayoutsForDownload: h.getPackLayoutsForDownload, recordDownload: h.recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset: h.fetchAsset }));

import { GET } from '@/app/api/download/pack/[packId]/route';
const ctx = (id: string) => ({ params: Promise.resolve({ packId: id }) });
const req = () => new Request('http://test/api/download/pack/p1');

beforeEach(() => {
  h.getEntitlementsForUser.mockResolvedValue([]);
  h.getPackForDownload.mockResolvedValue({ id: 'p1', slug: 'agency-essentials' });
  h.fetchAsset.mockResolvedValue(Buffer.from('{"x":1}'));
  h.recordDownload.mockClear();
});

describe('GET /api/download/pack/[packId]', () => {
  it('403 when signed in but not entitled', async () => {
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(403);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });
  it('404 for an unknown pack', async () => {
    h.getPackForDownload.mockResolvedValue(null);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(404);
  });
  it('200 zip when the user owns the pack', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('agency-essentials.zip');
    expect(h.recordDownload).toHaveBeenCalled();
  });
  it('200 with all-access', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'all_access', source: 'subscription', expiresAt: null }]);
    expect((await GET(req(), ctx('p1'))).status).toBe(200);
  });
  it('404 when no asset resolves (entitled)', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    h.fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(404);
  });
});
