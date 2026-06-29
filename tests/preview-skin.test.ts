import { describe, it, expect } from 'vitest';
import { skeletonForType, skinForLayout } from '@/lib/preview/skin';

describe('skeletonForType', () => {
  it('maps types to their archetypes', () => {
    expect(skeletonForType('hero')).toBe('hero');
    expect(skeletonForType('cta')).toBe('hero');
    expect(skeletonForType('pricing')).toBe('columns');
    expect(skeletonForType('gallery')).toBe('grid');
    expect(skeletonForType('blog')).toBe('grid');
    expect(skeletonForType('full_landing')).toBe('page');
    expect(skeletonForType('pack')).toBe('pack');
  });
  it('falls back to hero for unknown/empty', () => {
    expect(skeletonForType('nope')).toBe('hero');
    expect(skeletonForType(null)).toBe('hero');
    expect(skeletonForType(undefined)).toBe('hero');
  });
});

describe('skinForLayout', () => {
  it('dark style overrides to the dark treatment regardless of color', () => {
    const s = skinForLayout({ color: 'green', style: 'dark' });
    expect(s.onDark).toBe(true);
    expect(s.bg).toContain('#0B3558');
  });
  it('tints by the color axis value when not dark', () => {
    const s = skinForLayout({ color: 'green', style: 'minimal' });
    expect(s.onDark).toBe(false);
    expect(s.bg).toContain('#0E9F6E');
  });
  it('defaults to the blue stops when color is missing/unknown', () => {
    expect(skinForLayout({}).bg).toContain('#006BFF');
    expect(skinForLayout({ color: 'chartreuse' }).bg).toContain('#006BFF');
  });
});
