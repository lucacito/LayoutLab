import { describe, it, expect, beforeAll } from 'vitest';

const hasDb = !!process.env.POSTGRES_URL;

describe.skipIf(!hasDb)('admin DB layer (needs a seeded POSTGRES_URL)', () => {
  let m: typeof import('@/lib/admin/queries') & typeof import('@/lib/admin/mutations');

  beforeAll(async () => {
    m = { ...(await import('@/lib/admin/queries')), ...(await import('@/lib/admin/mutations')) } as any;
  });

  it('statusCounts returns a count per status', async () => {
    const c = await m.statusCounts();
    expect(c).toHaveProperty('published');
    expect(typeof c.published).toBe('number');
  });

  it('listLayoutsByStatus only returns rows of that status', async () => {
    const rows = await m.listLayoutsByStatus('published');
    for (const r of rows) expect(r.status).toBe('published');
  });
});
