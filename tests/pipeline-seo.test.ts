import { describe, it, expect, vi } from 'vitest';
import { slugify, generateSeo } from '@/pipeline/seo';

describe('slugify', () => {
  it('lowercases, strips punctuation, and hyphenates', () => {
    expect(slugify('Bold SaaS Hero!')).toBe('bold-saas-hero');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
  });
});

describe('generateSeo', () => {
  const target = { type: 'hero', niche: 'saas', style: 'minimal' };
  it('returns SEO with clamped axes and a slug derived from the title', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({
          title: 'Minimal SaaS Hero',
          metaDescription: 'A clean hero.',
          keywords: ['hero', 'saas'],
          axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue', 'not-a-real-color'] },
        }),
      ),
    };
    const seo = await generateSeo('{"content":[]}', target, { llm });
    expect(seo.slug).toBe('minimal-saas-hero');
    expect(seo.axes.colors).toContain('blue');
    expect(seo.axes.colors).not.toContain('not-a-real-color'); // clamped to AXIS_VALUES.color
    expect(seo.axes.type).toBe('hero');
  });

  it('falls back to the target axes when the model returns unknown axis values', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({ title: 'X', metaDescription: 'y', keywords: [], axes: { type: 'bogus', niche: 'bogus', style: 'bogus', colors: [] } }),
      ),
    };
    const seo = await generateSeo('{}', target, { llm });
    expect(seo.axes.type).toBe('hero');
    expect(seo.axes.niche).toBe('saas');
    expect(seo.axes.style).toBe('minimal');
  });
});
