import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const h = vi.hoisted(() => ({ orderBy: vi.fn(async (..._args: unknown[]) => [] as unknown[]) }));
vi.mock('@/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ orderBy: h.orderBy }) }) }) },
}));

import { listPacks } from '@/lib/catalog/queries';

const render = (chunk: unknown) => new PgDialect().sqlToQuery(chunk as never).sql;

describe('listPacks', () => {
  beforeEach(() => h.orderBy.mockClear());

  it('lists the newest pack first (created_at descending), title only as the tie-break', async () => {
    await listPacks();
    const sqls = h.orderBy.mock.calls[0].map(render);
    expect(sqls[0]).toMatch(/"packs"\."created_at" desc/i);
    expect(sqls[1]).toMatch(/"packs"\."title"( asc)?$/i);
  });
});
