import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the value passed to drizzle's eq() so we can prove the email was
// normalized BEFORE it hit the query.
const eqArgs: unknown[] = [];
vi.mock('drizzle-orm', async (orig) => {
  const mod = await orig<typeof import('drizzle-orm')>();
  return { ...mod, eq: (col: unknown, val: unknown) => { eqArgs.push(val); return (mod.eq as any)(col, val); } };
});

const limit = vi.fn(async () => [{ id: 'u1' }]);
vi.mock('@/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }),
  },
}));

beforeEach(() => { eqArgs.length = 0; limit.mockResolvedValue([{ id: 'u1' }]); });

describe('findOrCreateUserByEmail', () => {
  it('normalizes the email (trim + lowercase) before querying', async () => {
    const { findOrCreateUserByEmail } = await import('@/lib/users/find-or-create');
    const id = await findOrCreateUserByEmail('  Buyer@Example.COM ');
    expect(id).toBe('u1');
    expect(eqArgs).toContain('buyer@example.com');
    expect(eqArgs).not.toContain('  Buyer@Example.COM ');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('findOrCreateUserByEmail integration (needs POSTGRES_URL)', () => {
  it('upserts and returns a stable id regardless of email casing', async () => {
    vi.resetModules();
    const real = await vi.importActual<typeof import('@/lib/users/find-or-create')>('@/lib/users/find-or-create');
    const a = await real.findOrCreateUserByEmail('Case@Test.com');
    const b = await real.findOrCreateUserByEmail('case@test.com');
    expect(a).toBe(b);
  });
});
