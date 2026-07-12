import { describe, expect, it } from 'vitest';
import { freeDownloadTarget, FREE_DOWNLOAD_PRODUCTS } from '@/lib/license-server/free-download';

const release = { version: '3.0.0', blobKey: 'https://store.public.blob.vercel-storage.com/plugins/x/nonce/x-3.0.0.zip', changelog: null };

describe('freeDownloadTarget', () => {
  it('returns the blob URL for a free-downloadable product with a release', async () => {
    const r = await freeDownloadTarget('ai-editor-divi5-pro', async () => release);
    expect(r).toEqual({ ok: true, url: release.blobKey });
  });
  it('rejects products not on the free list (paid Pro zips stay gated)', async () => {
    const r = await freeDownloadTarget('elementor-to-divi5-pro', async () => release);
    expect(r).toEqual({ ok: false, status: 404 });
  });
  it('rejects unknown products', async () => {
    expect(await freeDownloadTarget('nope', async () => release)).toEqual({ ok: false, status: 404 });
  });
  it('404s when no release exists yet', async () => {
    expect(await freeDownloadTarget('ai-editor-divi5-pro', async () => null)).toEqual({ ok: false, status: 404 });
  });
  it('the free list contains exactly the AI Editor', () => {
    expect(FREE_DOWNLOAD_PRODUCTS).toEqual(['ai-editor-divi5-pro']);
  });
});
