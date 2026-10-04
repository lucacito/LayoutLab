import { describe, it, expect, vi } from 'vitest';

const { dbSelect } = vi.hoisted(() => ({ dbSelect: vi.fn() }));
vi.mock('@/db/client', () => ({ db: { select: dbSelect } }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env, CRON_SECRET: 'topsecret' } };
});

import { GET } from '@/app/api/cron/renewal-reminders/route';
import { env } from '@/lib/env';

const call = (headers: Record<string, string> = {}, url = 'http://t/api/cron/renewal-reminders') => GET(new Request(url, { headers }));

describe('GET /api/cron/renewal-reminders', () => {
  it('rejects a request without the bearer secret, and never touches the database', async () => {
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await call({}, 'http://t/api/cron/renewal-reminders?secret=topsecret')).status).toBe(401);
    expect((await call({ authorization: 'topsecret' })).status).toBe(401);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('is off (500) when no secret is configured, rather than open', async () => {
    const e = env as Record<string, string | undefined>;
    const saved = e.CRON_SECRET;
    e.CRON_SECRET = undefined;
    try {
      expect((await call({ authorization: 'Bearer undefined' })).status).toBe(500);
    } finally {
      e.CRON_SECRET = saved;
    }
  });

  it('runs with the right secret and reports what it did', async () => {
    dbSelect.mockReturnValue({ from: () => ({ where: async () => [] }) });
    const res = await call({ authorization: 'Bearer topsecret' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: 0, sent: 0, failed: 0 });
  });
});
