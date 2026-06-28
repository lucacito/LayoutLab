import { describe, it, expect, vi } from 'vitest';
import { postIngest } from '@/pipeline/ingest';

const payload: any = { slug: 's', title: 't', type: 'hero', colors: [], diviJsonBlobKey: 'k', previewImageKeys: [], contentHash: 'h', validatorPassed: true };

function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

describe('postIngest', () => {
  it('sends a Bearer token to <url>/api/ingest and returns the body', async () => {
    const fetchFn = vi.fn(async () => res(201, { id: 'l1', status: 'pending', deduped: false }));
    const out = await postIngest(payload, { url: 'http://localhost:3000', token: 'tok', fetchFn });
    expect(out).toEqual({ id: 'l1', status: 'pending', deduped: false });
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:3000/api/ingest', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer tok' }),
    }));
  });

  it('throws on 401 and 422', async () => {
    await expect(postIngest(payload, { url: 'x', token: 't', fetchFn: vi.fn(async () => res(401, {})) })).rejects.toThrow(/401|auth/i);
    await expect(postIngest(payload, { url: 'x', token: 't', fetchFn: vi.fn(async () => res(422, { error: 'not_validated' })) })).rejects.toThrow(/422|not_validated/i);
  });
});
