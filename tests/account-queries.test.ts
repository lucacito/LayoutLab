// tests/account-queries.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeEntitlements } from '@/lib/account/queries';

const NOW = new Date('2026-06-28T00:00:00Z');

describe('summarizeEntitlements', () => {
  it('flags active all_access', () => {
    expect(summarizeEntitlements([{ scope: 'all_access', source: 'subscription', expiresAt: null }], NOW).allAccess).toBe(true);
  });
  it('ignores expired all_access and collects owned pack ids', () => {
    const r = summarizeEntitlements([
      { scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') },
      { scope: 'pack:p1', source: 'order', expiresAt: null },
      { scope: 'pack:p2', source: 'order', expiresAt: null },
    ], NOW);
    expect(r.allAccess).toBe(false);
    expect(r.ownedPackIds.sort()).toEqual(['p1', 'p2']);
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('account queries (integration — needs a seeded POSTGRES_URL)', () => {
  it('getUserIdByEmail returns null for an unknown email', async () => {
    const q = await import('@/lib/account/queries');
    expect(await q.getUserIdByEmail('nobody@example.com')).toBeNull();
  });
});
