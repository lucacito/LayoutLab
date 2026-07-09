import { describe, it, expect } from 'vitest';
import { buildIngestPayload } from '@/pipeline/run';
import type { LayoutSeo } from '@/pipeline/seo';

const parts = { diviJsonBlobKey: 'k', previewImageKeys: ['p'], hash: 'h' };

function seoWith(typeGuess: string): LayoutSeo {
  return {
    title: 'T', slug: 't', metaDescription: 'd', keywords: ['k'],
    axes: { type: typeGuess, niche: 'ecommerce', style: 'minimal', colors: ['blue'] },
  } as LayoutSeo;
}

describe('buildIngestPayload — shop type pinning', () => {
  it("pins type='shop' for a shop target even when SEO guesses another type", () => {
    const item = { target: { type: 'shop', niche: 'ecommerce', style: 'minimal' } } as any;
    const payload = buildIngestPayload(item, seoWith('gallery'), parts);
    expect(payload.type).toBe('shop');
    expect(payload.tags?.find((t: any) => t.axis === 'type')?.slug).toBe('shop');
  });

  it('keeps the SEO-inferred type for non-shop targets', () => {
    const item = { target: { type: 'hero', niche: 'saas', style: 'bold' } } as any;
    const payload = buildIngestPayload(item, seoWith('features'), parts);
    expect(payload.type).toBe('features');
  });
});
