import { describe, it, expect } from 'vitest';
import { canDownloadLayout, isActiveAllAccess } from '@/lib/stripe/entitlements';

const NOW = new Date('2026-06-28T00:00:00Z');
const base = { layoutPackIds: ['p1'], packKindById: { p1: 'paid' as const }, userEntitlements: [], now: NOW };

describe('isActiveAllAccess', () => {
  it('true when all_access has no expiry or a future expiry', () => {
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: null }, NOW)).toBe(true);
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-07-01') }, NOW)).toBe(true);
  });
  it('false when expired or not all_access', () => {
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }, NOW)).toBe(false);
    expect(isActiveAllAccess({ scope: 'pack:p1', source: 'order', expiresAt: null }, NOW)).toBe(false);
  });
});

describe('canDownloadLayout', () => {
  it('allows when the user owns a pack the layout belongs to', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'pack:p1', source: 'order', expiresAt: null }] })).toBe(true);
  });
  it('allows with active all_access', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: null }] })).toBe(true);
  });
  it('denies with expired all_access and no pack', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }] })).toBe(false);
  });
  it('allows a free-pack layout the user captured email for', () => {
    expect(canDownloadLayout({ layoutPackIds: ['f1'], packKindById: { f1: 'free' }, userEntitlements: [], freeCapturedPackIds: ['f1'], now: NOW })).toBe(true);
  });
  it('denies when the user owns a different pack', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'pack:other', source: 'order', expiresAt: null }] })).toBe(false);
  });
  it('denies with no entitlements', () => {
    expect(canDownloadLayout(base)).toBe(false);
  });
});
