import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  INDEXNOW_KEY,
  indexNowEnabled,
  buildIndexNowPayload,
  submitToIndexNow,
} from '@/lib/seo/indexnow';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('indexNowEnabled', () => {
  it('is enabled for the real production host', () => {
    expect(indexNowEnabled('https://divi5lab.com')).toBe(true);
  });
  it('is disabled for localhost and loopback', () => {
    expect(indexNowEnabled('http://localhost:3000')).toBe(false);
    expect(indexNowEnabled('http://127.0.0.1:3000')).toBe(false);
  });
  it('is disabled for Vercel preview deployments', () => {
    expect(indexNowEnabled('https://divi5lab-git-x.vercel.app')).toBe(false);
  });
  it('is disabled for a malformed url', () => {
    expect(indexNowEnabled('not-a-url')).toBe(false);
  });
});

describe('buildIndexNowPayload', () => {
  it('builds a spec-compliant payload with host, key, keyLocation and urlList', () => {
    const p = buildIndexNowPayload('https://divi5lab.com', [
      'https://divi5lab.com/layouts/hero-a',
      'https://divi5lab.com/layouts/hero-b',
    ]);
    expect(p.host).toBe('divi5lab.com');
    expect(p.key).toBe(INDEXNOW_KEY);
    expect(p.keyLocation).toBe(`https://divi5lab.com/${INDEXNOW_KEY}.txt`);
    expect(p.urlList).toHaveLength(2);
  });
  it('normalizes a trailing slash on the site url for keyLocation', () => {
    const p = buildIndexNowPayload('https://divi5lab.com/', ['https://divi5lab.com/x']);
    expect(p.keyLocation).toBe(`https://divi5lab.com/${INDEXNOW_KEY}.txt`);
  });
});

describe('submitToIndexNow', () => {
  it('POSTs the payload to the IndexNow API when enabled', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const ok = await submitToIndexNow('https://divi5lab.com', ['https://divi5lab.com/layouts/x']);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('indexnow');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.urlList).toEqual(['https://divi5lab.com/layouts/x']);
    expect(body.key).toBe(INDEXNOW_KEY);
  });

  it('does not call fetch (and returns false) when disabled for the host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ok = await submitToIndexNow('http://localhost:3000', ['http://localhost:3000/x']);
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call fetch when there are no urls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ok = await submitToIndexNow('https://divi5lab.com', []);
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the network fails (best-effort)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const ok = await submitToIndexNow('https://divi5lab.com', ['https://divi5lab.com/x']);
    expect(ok).toBe(false);
  });
});
