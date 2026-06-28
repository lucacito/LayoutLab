import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIG = { ...process.env };
beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { process.env = { ...ORIG }; vi.unstubAllGlobals(); vi.resetModules(); });

describe('syncContact', () => {
  it('no LOOPS_API_KEY: logs, no fetch, returns { synced: false }', async () => {
    delete process.env.LOOPS_API_KEY;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { syncContact } = await import('@/lib/email/loops');
    const res = await syncContact({ email: 'a@b.c', packId: 'p1' });
    expect(res).toEqual({ synced: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('with key: POSTs to Loops with bearer + email, returns { synced: true }', async () => {
    process.env.LOOPS_API_KEY = 'loops_test';
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { syncContact } = await import('@/lib/email/loops');
    const res = await syncContact({ email: 'a@b.c', source: 'free_pack', packId: 'p1' });
    expect(res).toEqual({ synced: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain('app.loops.so/api/v1/contacts/update');
    expect(init.headers as Record<string, string>).toMatchObject({ Authorization: 'Bearer loops_test' });
    expect(JSON.parse(init.body as string).email).toBe('a@b.c');
  });

  it('with key but API error: returns { synced: false } (does not throw)', async () => {
    process.env.LOOPS_API_KEY = 'loops_test';
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { syncContact } = await import('@/lib/email/loops');
    expect(await syncContact({ email: 'a@b.c' })).toEqual({ synced: false });
  });
});
