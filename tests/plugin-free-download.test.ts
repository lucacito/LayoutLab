import { describe, it, expect } from 'vitest';
import { freeDownloadTarget, FREE_DOWNLOAD_PRODUCTS } from '@/lib/license-server/free-download';
import { PLUGIN_PRODUCTS } from '@/lib/license-server/core';

const release = { version: '1.0.0', blobKey: 'https://store.public.blob.vercel-storage.com/x.zip', changelog: null };

describe('freeDownloadTarget (retired route)', () => {
  it('no product is free to download, in particular not the paid AI Editor Pro zip', async () => {
    expect(FREE_DOWNLOAD_PRODUCTS).toEqual([]);
    for (const product of [...PLUGIN_PRODUCTS, 'ai-editor-divi5-pro', 'nope']) {
      expect(await freeDownloadTarget(product, async () => release)).toEqual({ ok: false, status: 404 });
    }
  });
  it('never even looks up a release for a product that is not free', async () => {
    let looked = false;
    await freeDownloadTarget('ai-editor-divi5-pro', async () => { looked = true; return release; });
    expect(looked).toBe(false);
  });
});
