import { describe, it, expect } from 'vitest';
import { axisLabel, taxonomyFallbackCopy } from '@/lib/seo/taxonomy-copy';

describe('axisLabel', () => {
  it('humanizes snake_case values', () => {
    expect(axisLabel('real_estate')).toBe('Real Estate');
    expect(axisLabel('full_landing')).toBe('Full Landing');
    expect(axisLabel('minimal')).toBe('Minimal');
  });
});

describe('taxonomyFallbackCopy', () => {
  it('produces non-empty, count-aware copy with the humanized value', () => {
    const c = taxonomyFallbackCopy('style', 'minimal', 12);
    expect(c.intro).toContain('Minimal');
    expect(c.intro).toMatch(/12/);
    expect(c.metaTitle).toContain('Minimal');
    expect(c.metaTitle.length).toBeGreaterThan(0);
    expect(c.metaDescription.length).toBeGreaterThan(0);
  });
  it('reads naturally when count is 0 (no "0 layouts" awkwardness required, just non-empty)', () => {
    const c = taxonomyFallbackCopy('type', 'hero', 0);
    expect(c.intro.length).toBeGreaterThan(0);
    expect(c.metaTitle).toContain('Hero');
  });
});
