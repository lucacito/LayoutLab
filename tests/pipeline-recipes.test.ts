import { describe, it, expect } from 'vitest';
import { MATRIX, targetKey, planTargets, buildVariants, buildGenerationPrompt, buildRepairPrompt } from '@/pipeline/recipes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('coverage matrix + plan', () => {
  it('every MATRIX target uses known axis values', () => {
    expect(MATRIX.length).toBeGreaterThan(0);
    for (const t of MATRIX) {
      expect(AXIS_VALUES.type).toContain(t.type);
      expect(AXIS_VALUES.niche).toContain(t.niche);
      expect(AXIS_VALUES.style).toContain(t.style);
    }
  });
  it('planTargets skips covered combos and honors count', () => {
    const covered = new Set([targetKey(MATRIX[0])]);
    const planned = planTargets(MATRIX, covered);
    expect(planned.map(targetKey)).not.toContain(targetKey(MATRIX[0]));
    expect(planTargets(MATRIX, new Set(), 2)).toHaveLength(2);
  });
});

describe('buildVariants', () => {
  it('produces count variants per type, each with a driven color + placement', () => {
    const v = buildVariants(['hero'], 5);
    expect(v).toHaveLength(5);
    for (const t of v) {
      expect(t.type).toBe('hero');
      expect(AXIS_VALUES.color).toContain(t.color);
      expect(typeof t.layout).toBe('string');
      expect(AXIS_VALUES.niche).toContain(t.niche);
      expect(AXIS_VALUES.style).toContain(t.style);
    }
    // Genuinely varied, not all the same combination.
    const combos = new Set(v.map((t) => `${t.niche}|${t.style}|${t.color}|${t.layout}`));
    expect(combos.size).toBeGreaterThan(1);
  });
  it('handles multiple types and is deterministic', () => {
    expect(buildVariants(['hero', 'cta'], 3)).toHaveLength(6);
    expect(buildVariants(['hero'], 4)).toEqual(buildVariants(['hero'], 4));
  });
});

describe('prompt builders', () => {
  const guide = { style: 'STYLE GUIDE TEXT', schema: 'SCHEMA TEXT', examples: ['{"ex":1}'] };
  it('generation prompt embeds the grounding and the target', () => {
    const { system, prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(system + prompt).toContain('STYLE GUIDE TEXT');
    expect(system + prompt).toContain('SCHEMA TEXT');
    expect(prompt).toContain('hero');
    expect(prompt).toContain('saas');
  });
  it('grounds on the section recipe matching the target type', () => {
    const recipes = [
      { name: 'hero-cta', title: 'Hero', description: 'top of page', when: 'hero', markup: 'HERO_MARKUP' },
      { name: 'contact-form', title: 'Contact', description: 'lead capture', when: 'contact', markup: 'CONTACT_MARKUP' },
    ];
    const heroPrompt = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, { style: 's', schema: 'x', recipes }).prompt;
    expect(heroPrompt).toContain('HERO_MARKUP');
    expect(heroPrompt).not.toContain('CONTACT_MARKUP');
    const contactPrompt = buildGenerationPrompt({ type: 'contact', niche: 'real_estate', style: 'corporate' }, { style: 's', schema: 'x', recipes }).prompt;
    expect(contactPrompt).toContain('CONTACT_MARKUP');
  });
  it('drives the variation color + placement and instructs relevant images', () => {
    const t = { type: 'hero', niche: 'saas', style: 'bold', color: 'green', layout: 'image on the left of the headline' };
    const { prompt } = buildGenerationPrompt(t, { style: 's', schema: 'x', recipes: [{ name: 'hero-cta', title: 'H', description: 'd', when: 'w', markup: 'M' }] });
    expect(prompt).toContain('green color palette');
    expect(prompt).toContain('image on the left of the headline');
    expect(prompt.toLowerCase()).toContain('loremflickr');
  });
  it('repair prompt includes the prior JSON and the violation codes', () => {
    const { prompt } = buildRepairPrompt('{"bad":1}', [{ code: 'E_X', message: 'bad thing', path: 'a.b' }]);
    expect(prompt).toContain('E_X');
    expect(prompt).toContain('bad thing');
    expect(prompt).toContain('{"bad":1}');
  });
});
