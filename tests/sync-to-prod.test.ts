import { describe, it, expect } from 'vitest';
import { isSeedLayout, needsUpload, buildSyncPayload } from '@/pipeline/sync';

describe('isSeedLayout', () => {
  it('flags seed samples by their picsum placeholder previews', () => {
    expect(isSeedLayout(['https://picsum.photos/seed/x/1200/901'])).toBe(true);
    expect(isSeedLayout(['https://abc.public.blob.vercel-storage.com/layouts/x-desktop.png'])).toBe(false);
    expect(isSeedLayout(['/screenshots/x-desktop.png'])).toBe(false);
    expect(isSeedLayout([])).toBe(false);
  });
});

describe('needsUpload', () => {
  it('only local (non-http) keys need uploading to prod Blob', () => {
    expect(needsUpload('pipeline/out/layouts-json/abc.json')).toBe(true);
    expect(needsUpload('/screenshots/abc-desktop.png')).toBe(true);
    expect(needsUpload('https://abc.public.blob.vercel-storage.com/layouts/abc.json')).toBe(false);
    expect(needsUpload('http://x/y')).toBe(false);
  });
});

describe('buildSyncPayload', () => {
  const row = {
    slug: 'bold-fitness-hero', title: 'Bold Fitness Hero', description: 'A hero.',
    type: 'hero', niche: 'fitness', style: 'bold', colors: ['orange'],
    contentHash: 'hash123', perceptualHash: 'phash', variant: null,
    seo: { metaTitle: 'Bold Fitness Hero', metaDescription: 'A hero.', keywords: ['divi', 'fitness'] },
  };
  it('assembles a valid ingest payload from a row + resolved keys + tags', () => {
    const payload = buildSyncPayload(row as any, {
      diviJsonBlobKey: 'https://blob/abc.json',
      previewImageKeys: ['https://blob/abc-desktop.png'],
      tags: [{ axis: 'type' as const, slug: 'hero' }],
    });
    expect(payload.slug).toBe('bold-fitness-hero');
    expect(payload.diviJsonBlobKey).toBe('https://blob/abc.json');
    expect(payload.previewImageKeys).toEqual(['https://blob/abc-desktop.png']);
    expect(payload.validatorPassed).toBe(true);
    expect(payload.contentHash).toBe('hash123');
    expect(payload.tags).toEqual([{ axis: 'type', slug: 'hero' }]);
    expect(payload.seo?.metaTitle).toBe('Bold Fitness Hero');
  });
  it('omits a null variant/perceptualHash rather than passing null', () => {
    const payload = buildSyncPayload({ ...row, variant: null, perceptualHash: null } as any, {
      diviJsonBlobKey: 'k', previewImageKeys: [], tags: [],
    });
    expect(payload.variant).toBeUndefined();
    expect(payload.perceptualHash).toBeUndefined();
  });
});
