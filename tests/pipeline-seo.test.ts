import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  slugify,
  generateSeo,
  seoMinMetaDescriptionLength,
  seoMinKeywords,
  DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH,
  DEFAULT_SEO_MIN_KEYWORDS,
} from '@/pipeline/seo';

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

describe('generateSeo — quality floor (T2.4)', () => {
  const target = { type: 'hero', niche: 'saas', style: 'minimal' };
  const GOOD = JSON.stringify({
    title: 'Minimal SaaS Hero',
    metaDescription: 'A clean, conversion-focused hero section built for SaaS teams launching a modern product page.',
    keywords: ['hero', 'saas', 'minimal', 'landing page'],
    axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue'] },
  });
  const BAD = JSON.stringify({
    title: 'X',
    metaDescription: 'Too short.',
    keywords: ['hero'],
    axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] },
  });

  it('retries once when metaDescription/keywords miss the floor, and succeeds if the retry meets it', async () => {
    let calls = 0;
    const llm = { complete: vi.fn(async () => (calls++ === 0 ? BAD : GOOD)) };
    const seo = await generateSeo('{"content":[]}', target, { llm });
    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect(seo.metaDescription.length).toBeGreaterThanOrEqual(seoMinMetaDescriptionLength());
    expect(seo.keywords.length).toBeGreaterThanOrEqual(seoMinKeywords());
    expect(seo.seoRetried).toBe(true);
    expect(seo.seoFloorMissed).toBe(false);
    // The retry prompt must name what was missing (mirrors the repair-prompt pattern).
    const completeCalls = llm.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    const retryPrompt = completeCalls[1][0].prompt;
    expect(retryPrompt).toMatch(/metaDescription/i);
    expect(retryPrompt).toMatch(/keyword/i);
  });

  it('flags (not drops) a layout still under the floor after one retry — never throws', async () => {
    const llm = { complete: vi.fn(async () => BAD) };
    const log = vi.fn();
    const seo = await generateSeo('{"content":[]}', target, { llm, log });
    expect(llm.complete).toHaveBeenCalledTimes(2); // exactly one retry, not an infinite loop
    expect(seo.seoFloorMissed).toBe(true);
    expect(seo.seoRetried).toBe(true);
    // Still returns real data — not dropped.
    expect(seo.metaDescription).toBe('Too short.');
    expect(seo.title).toBe('X');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/floor/i));
  });

  it('does not retry when the first response already meets the floor', async () => {
    const llm = { complete: vi.fn(async () => GOOD) };
    const seo = await generateSeo('{"content":[]}', target, { llm });
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(seo.seoRetried).toBe(false);
    expect(seo.seoFloorMissed).toBe(false);
  });
});

describe('generateSeo — clamp visibility (T2.4)', () => {
  const target = { type: 'hero', niche: 'saas', style: 'minimal' };

  it('logs and reports each axis/color clamp with proposed -> clamped values', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({
          title: 'Minimal SaaS Hero',
          metaDescription: 'A clean, conversion-focused hero section built for SaaS teams launching a modern product page.',
          keywords: ['hero', 'saas', 'minimal', 'landing page'],
          axes: { type: 'agency-bogus', niche: 'saas', style: 'minimal', colors: ['blue', 'not-a-real-color'] },
        }),
      ),
    };
    const log = vi.fn();
    const seo = await generateSeo('{"content":[]}', target, { llm, log });

    expect(seo.seoClamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ axis: 'type', proposed: 'agency-bogus', clamped: 'hero' }),
        expect.objectContaining({ axis: 'colors', proposed: ['blue', 'not-a-real-color'], clamped: ['blue'] }),
      ]),
    );
    // one log line per clamp, mentioning the axis and both values
    const clampLogs = log.mock.calls.map((c) => c[0] as string).filter((m) => /clamp/i.test(m));
    expect(clampLogs.length).toBeGreaterThanOrEqual(2);
    expect(clampLogs.some((m) => m.includes('agency-bogus') && m.includes('hero'))).toBe(true);
  });

  it('reports no clamps when every axis value is already valid', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({
          title: 'Minimal SaaS Hero',
          metaDescription: 'A clean, conversion-focused hero section built for SaaS teams launching a modern product page.',
          keywords: ['hero', 'saas', 'minimal', 'landing page'],
          axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue'] },
        }),
      ),
    };
    const seo = await generateSeo('{"content":[]}', target, { llm });
    expect(seo.seoClamps).toEqual([]);
  });
});

describe('seoMinMetaDescriptionLength / seoMinKeywords (env-tunable, T2.4)', () => {
  const ORIGINAL_LEN = process.env.SEO_MIN_META_DESCRIPTION_LENGTH;
  const ORIGINAL_KW = process.env.SEO_MIN_KEYWORDS;
  afterEach(() => {
    if (ORIGINAL_LEN === undefined) delete process.env.SEO_MIN_META_DESCRIPTION_LENGTH;
    else process.env.SEO_MIN_META_DESCRIPTION_LENGTH = ORIGINAL_LEN;
    if (ORIGINAL_KW === undefined) delete process.env.SEO_MIN_KEYWORDS;
    else process.env.SEO_MIN_KEYWORDS = ORIGINAL_KW;
  });

  it('defaults when unset', () => {
    delete process.env.SEO_MIN_META_DESCRIPTION_LENGTH;
    delete process.env.SEO_MIN_KEYWORDS;
    expect(seoMinMetaDescriptionLength()).toBe(DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH);
    expect(seoMinKeywords()).toBe(DEFAULT_SEO_MIN_KEYWORDS);
  });

  it('honors a valid override', () => {
    process.env.SEO_MIN_META_DESCRIPTION_LENGTH = '40';
    process.env.SEO_MIN_KEYWORDS = '5';
    expect(seoMinMetaDescriptionLength()).toBe(40);
    expect(seoMinKeywords()).toBe(5);
  });

  it('falls back to the default on a non-numeric override', () => {
    process.env.SEO_MIN_META_DESCRIPTION_LENGTH = 'not-a-number';
    process.env.SEO_MIN_KEYWORDS = 'nope';
    expect(seoMinMetaDescriptionLength()).toBe(DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH);
    expect(seoMinKeywords()).toBe(DEFAULT_SEO_MIN_KEYWORDS);
  });
});
