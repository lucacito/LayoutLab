import { describe, it, expect, vi } from 'vitest';
import { previewUrls, uploadLayout } from '@/pipeline/upload';

describe('previewUrls', () => {
  it('is deterministic per hash and returns 3 by default', () => {
    const a = previewUrls('abc');
    expect(a).toHaveLength(3);
    expect(previewUrls('abc')).toEqual(a);
    expect(a[0]).toContain('abc');
  });
});

describe('uploadLayout', () => {
  it('uploads JSON to Blob when a token is present', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const r = await uploadLayout('h1', '{"x":1}', { hasBlobToken: true, outDir: '/tmp/out', upload });
    expect(upload).toHaveBeenCalledOnce();
    expect(r.diviJsonBlobKey).toBe('layouts/h1.json');
    expect(r.previewImageKeys).toHaveLength(3);
  });

  it('writes JSON locally when no token', async () => {
    const writeFile = vi.fn();
    const r = await uploadLayout('h2', '{"x":1}', { hasBlobToken: false, outDir: '/tmp/out', writeFile });
    expect(writeFile).toHaveBeenCalledWith('/tmp/out/h2.json', '{"x":1}');
    expect(r.diviJsonBlobKey).toBe('/tmp/out/h2.json');
  });
});
