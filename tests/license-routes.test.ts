import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRateLimit } from '@/lib/rate-limit';

const findByKey = vi.fn();
const upsertActivation = vi.fn();
const markDeactivated = vi.fn();
vi.mock('@/lib/license-server/store', () => ({
  dbLicenseStore: {
    findByKey: (...a: unknown[]) => findByKey(...a),
    upsertActivation: (...a: unknown[]) => upsertActivation(...a),
    markDeactivated: (...a: unknown[]) => markDeactivated(...a),
    latestRelease: vi.fn(),
  },
}));

import { POST as activate } from '@/app/api/license/activate/route';
import { POST as validate } from '@/app/api/license/validate/route';
import { POST as deactivate } from '@/app/api/license/deactivate/route';

const LICENSE = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', status: 'active', currentPeriodEnd: null,
};

function req(body: unknown): Request {
  return new Request('http://test.local/api/license/x', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => { vi.clearAllMocks(); __resetRateLimit(); });

describe('POST /api/license/activate', () => {
  it('200s a valid activation', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await activate(req({
      key: LICENSE.licenseKey, site_url: 'https://client.com', product: 'elementor-to-divi5-pro', plugin_version: '1.0.0',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ status: 'active', product: 'elementor-to-divi5-pro' });
    expect(upsertActivation).toHaveBeenCalledOnce();
  });
  it('400s missing fields', async () => {
    const res = await activate(req({ key: 'x' }));
    expect(res.status).toBe(400);
  });
  it('404s unknown key', async () => {
    findByKey.mockResolvedValue(null);
    const res = await activate(req({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', site_url: 'a.com', product: 'elementor-to-divi5-pro' }));
    expect(res.status).toBe(404);
  });
  it('429s past the rate limit', async () => {
    findByKey.mockResolvedValue(null);
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await activate(req({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', site_url: 'a.com', product: 'elementor-to-divi5-pro' }));
    }
    expect(last!.status).toBe(429);
  });
});

describe('POST /api/license/validate', () => {
  it('200s and refreshes last seen', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await validate(req({ key: LICENSE.licenseKey, site_url: 'client.com', product: 'elementor-to-divi5-pro' }));
    expect(res.status).toBe(200);
    expect(upsertActivation).toHaveBeenCalledOnce();
  });
});

describe('POST /api/license/deactivate', () => {
  it('200s and marks deactivated', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await deactivate(req({ key: LICENSE.licenseKey, site_url: 'client.com' }));
    expect(res.status).toBe(200);
    expect(markDeactivated).toHaveBeenCalledWith('lic_1', 'client.com');
  });
});
