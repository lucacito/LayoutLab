// tests/license-store.test.ts
import { describe, it, expect, vi } from 'vitest';
import { licenses as licensesTable, licenseActivations as activationsTable } from '@/db/schema';
import { dbLicenseStore, getLicensesForUser } from '@/lib/license-server/store';

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

// getLicensesForUser awaits `.where()` directly (no `.limit()`), and queries
// two tables (licenses, then licenseActivations per row) — table-aware so
// each query resolves to its own fake rows. `.limit` stays wired to the
// shared `limit` mock above so the existing findByKey tests are untouched.
let licenseRows: unknown[] = [];
let activationRows: unknown[] = [];

vi.mock('@/db/client', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = table === licensesTable ? licenseRows
            : table === activationsTable ? activationRows
            : [];
          const p = Promise.resolve(rows) as Promise<unknown[]> & { limit: typeof limit };
          p.limit = limit;
          return p;
        },
      }),
    }),
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

describe('getLicensesForUser', () => {
  it('maps a stored past_due license whose grace period has elapsed to the effective "expired" status', async () => {
    licenseRows = [{
      id: 'lic_2',
      userId: 'user_1',
      productSlug: 'elementor-to-divi5-pro',
      licenseKey: 'JHMG-EEEE-FFFF-GGGG-HHHH',
      status: 'past_due',
      // 8 days past period end — 1 day beyond the 7-day past_due grace.
      currentPeriodEnd: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    }];
    activationRows = [];

    const out = await getLicensesForUser('user_1');

    expect(out).toHaveLength(1);
    expect(out[0]?.status).toBe('expired');
  });

  it('leaves a stored active license as active', async () => {
    licenseRows = [{
      id: 'lic_3',
      userId: 'user_1',
      productSlug: 'elementor-to-divi5-pro',
      licenseKey: 'JHMG-IIII-JJJJ-KKKK-LLLL',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }];
    activationRows = [];

    const out = await getLicensesForUser('user_1');

    expect(out[0]?.status).toBe('active');
  });
});
