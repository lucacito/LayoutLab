import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRateLimit } from '@/lib/rate-limit';

const findByKey = vi.fn();
const latestRelease = vi.fn();
vi.mock('@/lib/license-server/store', () => ({
  dbLicenseStore: {
    findByKey: (...a: unknown[]) => findByKey(...a),
    latestRelease: (...a: unknown[]) => latestRelease(...a),
    upsertActivation: vi.fn(),
    markDeactivated: vi.fn(),
  },
}));
const fetchAsset = vi.fn();
vi.mock('@/lib/blob', () => ({ fetchAsset: (...a: unknown[]) => fetchAsset(...a) }));

import { GET as updateCheck } from '@/app/api/plugin/update-check/route';
import { GET as download } from '@/app/api/plugin/download/route';

const KEY = 'JHMG-AAAA-BBBB-CCCC-DDDD';
const LICENSE = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: KEY, status: 'active', currentPeriodEnd: null,
};
const RELEASE = { version: '1.2.0', blobKey: 'plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip', changelog: 'Fixes' };

beforeEach(() => { vi.clearAllMocks(); __resetRateLimit(); });

describe('GET /api/plugin/update-check', () => {
  it('returns update+package for a licensed older install', async () => {
    findByKey.mockResolvedValue(LICENSE);
    latestRelease.mockResolvedValue(RELEASE);
    const res = await updateCheck(new Request(
      `http://t.local/api/plugin/update-check?product=elementor-to-divi5-pro&version=1.0.0&key=${KEY}`,
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.update).toBe(true);
    expect(json.version).toBe('1.2.0');
    expect(String(json.package)).toContain('/api/plugin/download?product=elementor-to-divi5-pro&key=');
  });
  it('400s missing params', async () => {
    const res = await updateCheck(new Request('http://t.local/api/plugin/update-check?product=x'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/plugin/download', () => {
  it('streams the zip for a usable license', async () => {
    findByKey.mockResolvedValue(LICENSE);
    latestRelease.mockResolvedValue(RELEASE);
    fetchAsset.mockResolvedValue(Buffer.from('PKzipbytes'));
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('elementor-to-divi5-pro-1.2.0.zip');
    expect(fetchAsset).toHaveBeenCalledWith(RELEASE.blobKey);
  });
  it('403s an unusable license', async () => {
    findByKey.mockResolvedValue({ ...LICENSE, status: 'canceled' });
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(403);
  });
  it('404s an unknown key or missing release/asset', async () => {
    findByKey.mockResolvedValue(null);
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(404);
  });
  it('403s a product mismatch (key for the other plugin)', async () => {
    findByKey.mockResolvedValue({ ...LICENSE, productSlug: 'divi-to-elementor-pro' });
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(403);
  });
});
