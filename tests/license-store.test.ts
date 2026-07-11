// tests/license-store.test.ts
import { describe, it, expect, vi } from 'vitest';
import { dbLicenseStore } from '@/lib/license-server/store';

describe('dbLicenseStore shape', () => {
  it('implements the LicenseStore interface', () => {
    expect(typeof dbLicenseStore.findByKey).toBe('function');
    expect(typeof dbLicenseStore.upsertActivation).toBe('function');
    expect(typeof dbLicenseStore.markDeactivated).toBe('function');
    expect(typeof dbLicenseStore.latestRelease).toBe('function');
  });
});

// Mirrors tests/find-or-create-user.test.ts's db-mocking pattern: a chainable
// fake for `db.select().from().where().limit()`.
const limit = vi.fn(async () => [{
  id: 'lic_1',
  userId: 'user_1',
  productSlug: 'elementor-to-divi5-pro',
  licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
  status: 'active',
  currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
}]);
vi.mock('@/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  },
}));

describe('dbLicenseStore.findByKey', () => {
  it('maps the db row onto a LicenseRecord', async () => {
    const r = await dbLicenseStore.findByKey('JHMG-AAAA-BBBB-CCCC-DDDD');
    expect(r).toEqual({
      id: 'lic_1',
      userId: 'user_1',
      productSlug: 'elementor-to-divi5-pro',
      licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
      status: 'active',
      currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
    });
  });

  it('returns null when no row matches', async () => {
    limit.mockResolvedValueOnce([]);
    const r = await dbLicenseStore.findByKey('nope');
    expect(r).toBeNull();
  });
});
