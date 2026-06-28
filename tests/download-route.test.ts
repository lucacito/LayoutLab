// tests/download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  requireUser,
  getUserIdByEmail,
  getLayoutForDownload,
  getLayoutPackContext,
  getEntitlementsForUser,
  recordDownload,
  fetchAsset,
} = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ user: { email: 'buyer@example.com' } })),
  getUserIdByEmail: vi.fn(async () => 'u1'),
  getLayoutForDownload: vi.fn(async () => ({ id: 'l1', slug: 'bold-saas-hero', diviJsonBlobKey: 'pipeline/out/x.json' })),
  getLayoutPackContext: vi.fn(async () => ({ packIds: ['p1'], packKindById: { p1: 'paid' } })),
  getEntitlementsForUser: vi.fn(async () => [] as any[]),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async (): Promise<Buffer | null> => Buffer.from('{"content":[]}')),
}));

vi.mock('@/lib/auth/admin', () => ({ requireUser }));
vi.mock('@/lib/account/queries', () => ({ getUserIdByEmail, getLayoutForDownload, getLayoutPackContext, getEntitlementsForUser, recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset }));

import { GET } from '@/app/api/download/[layoutId]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ layoutId: id }) });
const req = () => new Request('http://test/api/download/l1');

beforeEach(() => { getEntitlementsForUser.mockResolvedValue([]); fetchAsset.mockResolvedValue(Buffer.from('{"content":[]}')); recordDownload.mockClear(); });

describe('GET /api/download/[layoutId]', () => {
  it('403 when the user is not entitled', async () => {
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(403);
    expect(recordDownload).not.toHaveBeenCalled();
  });

  it('200 zip when entitled (owns the pack)', async () => {
    getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('bold-saas-hero.zip');
    expect(recordDownload).toHaveBeenCalledWith('u1', 'l1', null);
  });

  it('404 when the asset is unavailable', async () => {
    getEntitlementsForUser.mockResolvedValue([{ scope: 'all_access', source: 'subscription', expiresAt: null }]);
    fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(404);
  });
});
