import { afterEach, describe, expect, it } from 'vitest';
import { buildGenerationPrompt } from '@/pipeline/recipes/prompts';
import type { Target } from '@/pipeline/recipes/matrix';
import type { Guide } from '@/pipeline/recipes/prompts';

const guide: Guide = {
  style: 'STYLE GUIDE BODY',
  schema: 'SCHEMA BODY',
  recipes: [
    { name: 'card-grid-3', title: 'Cards', description: 'cards', when: 'cards', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'icon-values', title: 'Values', description: 'v', when: 'v', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'blurb-grid', title: 'Blurbs', description: 'b', when: 'b', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'icon-features', title: 'Features', description: 'f', when: 'f', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
  ],
};

const cardsTarget: Target = {
  type: 'cards', niche: 'fitness', style: 'bold',
  variant: { group: 'cards-fitness-bold', columns: 3, icons: 'top', iconStyle: 'circle' },
};
const featuresTarget: Target = { type: 'features', niche: 'saas', style: 'minimal' };

afterEach(() => {
  delete process.env.ICON_CATALOG;
  delete process.env.USE_LIBRARY_EXEMPLARS;
  delete process.env.DESIGN_LANGUAGES;
});

describe('icon pick-list injection', () => {
  it('cards prompts carry the niche-relevant VERIFIED ICONS list instead of the recipe whitelist', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(cardsTarget, guide);
    expect(prompt).toContain('VERIFIED ICONS');
    expect(prompt).toContain('dumbbell (type:"fa", weight:"900", unicode:"&#xf44b;")'); // fitness glyph
    expect(prompt).not.toContain('ONLY from the grounding recipes'); // old whitelist clause gone
  });

  it('features prompts carry the list too', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(featuresTarget, guide);
    expect(prompt).toContain('VERIFIED ICONS');
    expect(prompt).toContain('unicode:"&#x'); // at least one concrete code present
  });

  it('ICON_CATALOG=0 restores the legacy recipe-whitelist clause byte-for-byte (escape hatch)', () => {
    process.env.ICON_CATALOG = '0';
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(cardsTarget, guide);
    expect(prompt).toContain('choose glyph unicodes ONLY from the grounding recipes (icon-features, blurb-grid, icon-values); never invent icon codes');
    expect(prompt).not.toContain('VERIFIED ICONS');
  });

  it('the pick-list stays out of the SYSTEM prompt (T1.4 cache property)', () => {
    const a = buildGenerationPrompt(cardsTarget, guide).system;
    const b = buildGenerationPrompt({ ...cardsTarget, niche: 'restaurant' }, guide).system;
    expect(a).toBe(b);
    expect(a).not.toContain('VERIFIED ICONS');
  });

  it('numbered-badge card variants do NOT get an icon list (no glyphs wanted)', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const t: Target = { ...cardsTarget, variant: { ...cardsTarget.variant!, iconStyle: 'number' } };
    const { prompt } = buildGenerationPrompt(t, guide);
    expect(prompt).not.toContain('VERIFIED ICONS');
  });
});
