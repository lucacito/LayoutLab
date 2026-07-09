import { describe, expect, it } from 'vitest';
import { articleJsonLd, productJsonLd, organizationId } from '@/lib/seo/jsonld';

describe('articleJsonLd', () => {
  it('emits an Article with publisher reference and dates', () => {
    const out = articleJsonLd({
      headline: 'Best Divi 5 Layouts for Agencies',
      description: 'A curated roundup.',
      url: 'https://divi5lab.com/guides/best-divi-5-layouts-for-agencies',
      datePublished: '2026-07-08',
      dateModified: '2026-07-08',
      authorName: 'Divi5Lab',
      publisherId: organizationId('https://divi5lab.com'),
      image: 'https://example.com/og.webp',
    });
    expect(out['@type']).toBe('Article');
    expect(out.headline).toBe('Best Divi 5 Layouts for Agencies');
    expect(out.datePublished).toBe('2026-07-08');
    expect(out.publisher).toEqual({ '@id': 'https://divi5lab.com/#organization' });
    expect(out.author).toEqual({ '@type': 'Organization', name: 'Divi5Lab' });
    expect(out.image).toBe('https://example.com/og.webp');
    expect(out.mainEntityOfPage).toBe('https://divi5lab.com/guides/best-divi-5-layouts-for-agencies');
  });

  it('omits image and dateModified when absent', () => {
    const out = articleJsonLd({
      headline: 'X',
      description: 'Y',
      url: 'https://divi5lab.com/guides/x',
      datePublished: '2026-07-01',
      authorName: 'Divi5Lab',
    });
    expect(out.image).toBeUndefined();
    expect(out.dateModified).toBeUndefined();
    expect(out.publisher).toBeUndefined();
  });
});

describe('productJsonLd images', () => {
  it('emits ImageObject array when images are provided', () => {
    const out = productJsonLd({
      name: 'Skyline Hero',
      url: 'https://divi5lab.com/layouts/skyline-hero',
      offer: { priceCents: 0 },
      images: [
        { url: 'https://blob/desktop.webp', caption: 'Skyline Hero — desktop screenshot' },
        { url: 'https://blob/mobile.webp', caption: 'Skyline Hero — mobile screenshot' },
      ],
    });
    expect(out.image).toEqual([
      { '@type': 'ImageObject', contentUrl: 'https://blob/desktop.webp', caption: 'Skyline Hero — desktop screenshot' },
      { '@type': 'ImageObject', contentUrl: 'https://blob/mobile.webp', caption: 'Skyline Hero — mobile screenshot' },
    ]);
  });

  it('keeps plain string image working when images not passed', () => {
    const out = productJsonLd({
      name: 'X',
      url: 'https://divi5lab.com/layouts/x',
      image: 'https://blob/cover.webp',
      offer: { priceCents: 0 },
    });
    expect(out.image).toBe('https://blob/cover.webp');
  });
});
