import { describe, it, expect } from 'vitest';
import { canDownloadPack } from '@/lib/stripe/entitlements';
const NOW = new Date('2026-06-29T00:00:00Z');

describe('canDownloadPack', () => {
  it('true when the user owns the pack', () => {
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [{ scope: 'pack:p1', source: 'order', expiresAt: null }], now: NOW })).toBe(true);
  });
  it('true with active all-access (any pack)', () => {
    expect(canDownloadPack({ packId: 'p9', userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: null }], now: NOW })).toBe(true);
  });
  it('false when neither owned nor all-access; ignores a different pack + expired all-access', () => {
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [{ scope: 'pack:p2', source: 'order', expiresAt: null }, { scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }], now: NOW })).toBe(false);
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [], now: NOW })).toBe(false);
  });
});
