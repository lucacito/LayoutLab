import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt, type Guide } from '@/pipeline/recipes/prompts';
import type { Target } from '@/pipeline/recipes/matrix';

const guide: Guide = {
  style: 'STYLE',
  schema: 'SCHEMA',
  recipes: [{ name: 'icon-values', title: 'Icon values', description: 'icon cards', when: 'cards', markup: '<!-- wp:divi/icon -->' }],
};

const base: Target = {
  type: 'cards',
  niche: 'saas',
  style: 'minimal',
  layout: '3 equal columns of cards',
  variant: { group: 'cards-saas-minimal', columns: 3, icons: 'top', iconStyle: 'circle' },
};

describe('cards prompt directives', () => {
  it('describes the animated card wrapper and circular icon badge', () => {
    const { prompt } = buildGenerationPrompt(base, guide);
    const p = prompt.toLowerCase();
    expect(p).toContain('hover');
    expect(p).toContain('box shadow');
    expect(p).toContain('border');
    expect(p).toMatch(/circular|circle/);
    expect(p).toContain('divi'); // divi-native icon constraint
  });

  it('uses a numbered badge when iconStyle is number', () => {
    const t: Target = { ...base, variant: { ...base.variant!, iconStyle: 'number' } };
    expect(buildGenerationPrompt(t, guide).prompt.toLowerCase()).toContain('number');
  });

  it('places the icon to the left when icons is left', () => {
    const t: Target = { ...base, variant: { ...base.variant!, icons: 'left' } };
    expect(buildGenerationPrompt(t, guide).prompt.toLowerCase()).toContain('left of the heading');
  });
});
