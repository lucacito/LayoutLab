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
