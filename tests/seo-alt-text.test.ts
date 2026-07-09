import { describe, expect, it } from 'vitest';
import { layoutAltText } from '@/lib/seo/alt-text';

describe('layoutAltText', () => {
  it('builds a descriptive keyword-rich alt', () => {
    expect(layoutAltText({ title: 'Skyline Hero', type: 'hero', niche: 'saas' })).toBe(
      'Skyline Hero — SaaS Hero layout built with Divi 5',
    );
  });

  it('handles underscored axis values with labels', () => {
    expect(layoutAltText({ title: 'Verity Estates', type: 'full_landing', niche: 'real_estate' })).toBe(
      'Verity Estates — Real Estate Full Landing layout built with Divi 5',
    );
  });

  it('degrades gracefully when axes are missing', () => {
    expect(layoutAltText({ title: 'Mystery', type: null, niche: null })).toBe(
      'Mystery — layout built with Divi 5',
    );
    expect(layoutAltText({ title: 'Solo', type: 'cta', niche: null })).toBe(
      'Solo — CTA layout built with Divi 5',
    );
  });
});
