import { describe, expect, it, vi } from 'vitest';
import {
  buildArticlePrompt,
  parseArticleResponse,
  generateLayoutArticle,
  meetsArticleFloor,
} from '@/pipeline/seo-article';

const LONG = 'This layout uses a strong headline hierarchy and generous spacing. '.repeat(20); // ~1300 chars

function validPayload() {
  return {
    article: {
      overview: LONG,
      features: ['One', 'Two', 'Three', 'Four', 'Five'],
      whoItsFor: 'Marketing teams at SaaS companies shipping a first landing page.',
      customization: 'Change palette via presets; swap imagery at matching aspect ratios.',
      faq: [
        { q: 'Is it responsive?', a: 'Yes, tuned at desktop and 390px widths with deliberate stacking.' },
        { q: 'Are images included?', a: 'Placeholder imagery ships with the layout and is easy to replace.' },
        { q: 'Does it need plugins?', a: 'No, only Divi 5 itself — every module is native.' },
        { q: 'Can I change fonts?', a: 'Yes, via Divi global presets so changes propagate.' },
      ],
    },
    meta: {
      metaTitle: 'Bold SaaS Hero — Free Divi 5 Hero Layout',
      metaDescription:
        'Download this bold SaaS hero for Divi 5: validated JSON, responsive at every width, native modules, and a commercial license — import it in seconds.',
    },
  };
}

describe('buildArticlePrompt', () => {
  it('grounds the prompt in taxonomy, paid status and the layout JSON', () => {
    const { system, user } = buildArticlePrompt({
      title: 'Bold SaaS Hero',
      type: 'hero',
      niche: 'saas',
      style: 'bold',
      paid: false,
      layoutJson: '{"content":{"module":"section"}}',
    });
    expect(system).toMatch(/JSON/);
    expect(user).toContain('Bold SaaS Hero');
    expect(user).toContain('hero');
    expect(user).toContain('saas');
    expect(user).toContain('free');
    expect(user).toContain('"module":"section"');
  });
});

describe('parseArticleResponse', () => {
  it('accepts a valid payload', () => {
    const out = parseArticleResponse(JSON.stringify(validPayload()));
    expect(out.article.features).toHaveLength(5);
    expect(out.meta.metaTitle).toContain('Divi 5');
  });

  it('throws when article shape is missing', () => {
    expect(() => parseArticleResponse(JSON.stringify({ meta: validPayload().meta }))).toThrow();
  });

  it('meetsArticleFloor rejects short overviews and thin FAQs', () => {
    const p = validPayload();
    p.article.overview = 'too short';
    expect(meetsArticleFloor(parseArticleResponse(JSON.stringify(p)))).toBe(false);
    const p2 = validPayload();
    p2.article.faq = p2.article.faq.slice(0, 1);
    expect(meetsArticleFloor(parseArticleResponse(JSON.stringify(p2)))).toBe(false);
    expect(meetsArticleFloor(parseArticleResponse(JSON.stringify(validPayload())))).toBe(true);
  });

  it('meetsArticleFloor rejects meta outside SERP bounds', () => {
    const p = validPayload();
    p.meta.metaTitle = 'An extremely long meta title that keeps going far past the sixty character serp limit';
    expect(meetsArticleFloor(parseArticleResponse(JSON.stringify(p)))).toBe(false);
  });
});

describe('generateLayoutArticle', () => {
  it('retries once on a floor miss and reports floorMissed=false when retry passes', async () => {
    const bad = validPayload();
    bad.article.overview = 'stub';
    const complete = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(bad))
      .mockResolvedValueOnce(JSON.stringify(validPayload()));
    const out = await generateLayoutArticle(
      { title: 'Bold SaaS Hero', type: 'hero', niche: 'saas', style: 'bold', paid: false, layoutJson: '{}' },
      { llm: { complete } },
    );
    expect(complete).toHaveBeenCalledTimes(2);
    expect(out.retried).toBe(true);
    expect(out.floorMissed).toBe(false);
    expect(out.article.overview.length).toBeGreaterThan(900);
  });

  it('flags floorMissed when the retry also fails', async () => {
    const bad = validPayload();
    bad.article.overview = 'stub';
    const complete = vi.fn().mockResolvedValue(JSON.stringify(bad));
    const out = await generateLayoutArticle(
      { title: 'X', type: 'hero', niche: 'saas', style: 'bold', paid: true, layoutJson: '{}' },
      { llm: { complete } },
    );
    expect(out.floorMissed).toBe(true);
  });
});
