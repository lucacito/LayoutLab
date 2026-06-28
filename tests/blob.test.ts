import { describe, it, expect, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (key: string) => ({ url: `https://blob.test/${key}` })),
}));

import { uploadAsset } from '@/lib/blob';

describe('uploadAsset', () => {
  it('returns the blob url for a key', async () => {
    const res = await uploadAsset('layouts/abc.json', Buffer.from('{}'), 'application/json');
    expect(res.url).toBe('https://blob.test/layouts/abc.json');
  });
});

import { assetUrl } from '@/lib/blob';

describe('assetUrl', () => {
  it('passes through absolute URLs (placeholder previews)', () => {
    expect(assetUrl('https://picsum.photos/seed/x/800/600')).toBe('https://picsum.photos/seed/x/800/600');
  });
  it('builds a blob url for a bare key', () => {
    expect(assetUrl('layouts/abc.png')).toContain('layouts/abc.png');
    expect(assetUrl('layouts/abc.png').startsWith('https://')).toBe(true);
  });
});
