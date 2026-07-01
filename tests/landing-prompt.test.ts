import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt, type Guide } from '@/pipeline/recipes/prompts';
import type { Target } from '@/pipeline/recipes/matrix';

const guide: Guide = {
  style: 'STYLE',
  schema: 'SCHEMA',
  recipes: [
    { name: 'hero-cta', title: 'Hero', description: 'hero', when: 'top', markup: '<!-- wp:divi/section -->A' },
    { name: 'icon-features', title: 'Feat', description: 'features', when: 'mid', markup: '<!-- wp:divi/section -->B' },
    { name: 'testimonial', title: 'Quote', description: 'quote', when: 'mid', markup: '<!-- wp:divi/section -->C' },
    { name: 'stats-counter', title: 'Stats', description: 'stats', when: 'mid', markup: '<!-- wp:divi/section -->D' },
    { name: 'card-grid-3', title: 'Cards', description: 'cards', when: 'mid', markup: '<!-- wp:divi/section -->E' },
  ],
};

describe('full_landing prompt', () => {
  const target: Target = { type: 'full_landing', niche: 'saas', style: 'bold' };

  it('describes a complete premium landing (hero → pricing → FAQ → CTA)', () => {
    const p = buildGenerationPrompt(target, guide).prompt.toLowerCase();
    for (const section of ['hero', 'testimonial', 'pricing', 'faq', 'cta']) {
      expect(p).toContain(section);
    }
    expect(p).toContain('multiple'); // multiple sections in one document
  });

  it('grounds the landing on more than two recipes', () => {
    const p = buildGenerationPrompt(target, guide).prompt;
    const exampleCount = (p.match(/Example \d+:/g) ?? []).length;
    expect(exampleCount).toBeGreaterThan(2);
  });
});
