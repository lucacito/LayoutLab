import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/ingest/route';
import { resolveIngestStatus } from '@/lib/ingest/status';
import sample from './fixtures/sample-ingest.json';

describe('resolveIngestStatus', () => {
  it('lands as pending by default (human approval gate)', () => {
    expect(resolveIngestStatus(undefined)).toEqual({ status: 'pending' });
    expect(resolveIngestStatus('false')).toEqual({ status: 'pending' });
    expect(resolveIngestStatus('0')).toEqual({ status: 'pending' });
  });
  it('auto-publishes with a publishedAt timestamp when auto-approve is enabled', () => {
    for (const on of ['1', 'true', 'TRUE']) {
      const r = resolveIngestStatus(on);
      expect(r.status).toBe('published');
      expect(r.publishedAt).toBeInstanceOf(Date);
    }
  });
});

const TOKEN = 'test-ingest-token'; // matches vitest.config.ts test.env

function post(body: unknown, token: string | null = TOKEN) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('http://test/api/ingest', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/ingest — auth + validation (no DB)', () => {
  it('401 without a token', async () => {
    expect((await POST(post(sample, null))).status).toBe(401);
  });
  it('401 with a wrong token', async () => {
    expect((await POST(post(sample, 'nope'))).status).toBe(401);
  });
  it('422 on invalid JSON', async () => {
    expect((await POST(post('not json{'))).status).toBe(422);
  });
  it('422 on a schema violation', async () => {
    const { title, ...bad } = sample as any;
    expect((await POST(post(bad))).status).toBe(422);
  });
  it('422 when validatorPassed is not true', async () => {
    const res = await POST(post({ ...(sample as any), contentHash: 'unvalidated-hash', validatorPassed: false }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('not_validated');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('POST /api/ingest — persistence (needs POSTGRES_URL)', () => {
  it('201 creates a pending layout, 200 dedupes on repeat', async () => {
    const unique = { ...(sample as any), slug: `e2e-${Date.now()}`, contentHash: `e2e-${Date.now()}` };
    const first = await POST(post(unique));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.status).toBe('pending');
    expect(firstBody.deduped).toBe(false);

    const second = await POST(post(unique));
    expect(second.status).toBe(200);
    expect((await second.json()).deduped).toBe(true);
  });
});
