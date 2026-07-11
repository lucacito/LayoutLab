import { afterEach, describe, expect, it } from 'vitest';
import { buildGenerationPrompt } from '@/pipeline/recipes/prompts';
import type { Target } from '@/pipeline/recipes/matrix';
import type { Guide } from '@/pipeline/recipes/prompts';

const guide: Guide = {
  style: 'STYLE GUIDE BODY',
  schema: 'SCHEMA BODY',
  recipes: [
    { name: 'hero-cta', title: 'Hero', description: 'hero', when: 'hero', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'card-grid-3', title: 'Cards', description: 'cards', when: 'cards', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'icon-values', title: 'Values', description: 'v', when: 'v', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'blurb-grid', title: 'Blurbs', description: 'b', when: 'b', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
    { name: 'icon-features', title: 'Features', description: 'f', when: 'f', markup: '<!-- wp:divi/section {} --><!-- /wp:divi/section -->' },
  ],
};

const heroTarget: Target = { type: 'hero', niche: 'saas', style: 'minimal', color: 'cool', layout: 'centered' };

afterEach(() => {
  delete process.env.DESIGN_LANGUAGES;
  delete process.env.USE_LIBRARY_EXEMPLARS;
});

describe('language injection (user prompt)', () => {
  it('injects the page design system block for a vary target', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(heroTarget, guide);
    expect(prompt).toContain('Page design system (');
    expect(prompt).toMatch(/Typography: headlines in/);
    expect(prompt).toMatch(/Spacing: section padding/);
  });

  it('DESIGN_LANGUAGES=0 removes the block (escape hatch)', () => {
    process.env.DESIGN_LANGUAGES = '0';
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(heroTarget, guide);
    expect(prompt).not.toContain('Page design system (');
  });

  it('same (style,niche), different color/layout -> can differ (entropy through vary targets)', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const languages = new Set(
      Array.from({ length: 12 }, (_, i) => {
        const t: Target = { ...heroTarget, color: `c${i}`, layout: `layout ${i}` };
        const m = buildGenerationPrompt(t, guide).prompt.match(/Page design system \(([a-z-]+)\//);
        return m?.[1];
      }),
    );
    expect(languages.size).toBeGreaterThanOrEqual(2);
  });

  it('designKey overrides color|layout as the discriminator', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const a = buildGenerationPrompt({ ...heroTarget, designKey: 'Acme', color: 'x', layout: 'y' }, guide).prompt;
    const b = buildGenerationPrompt({ ...heroTarget, designKey: 'Acme', color: 'z', layout: 'w' }, guide).prompt;
    const lang = (p: string) => p.match(/Page design system \(([a-z-]+\/[a-z0-9-]+)\)/)?.[1];
    expect(lang(a)).toBe(lang(b)); // same designKey -> same system, whatever color/layout say
  });
});

describe('grounding unlock (system prompt)', () => {
  it('system prompt permits STYLE GUIDE attribute shapes and forbids inventing paths', () => {
    const { system } = buildGenerationPrompt(heroTarget, guide);
    expect(system).toMatch(/STYLE GUIDE and (the )?recipes/i);
    expect(system).not.toMatch(/attribute shapes shown in the example recipes — never invent/);
  });

  it('adds the STYLING MOVES digest to the STABLE grounding (cache-eligible)', () => {
    const { system } = buildGenerationPrompt(heroTarget, guide);
    expect(system).toContain('=== STYLING MOVES');
    expect(system).toContain('glassmorphism');
  });

  it('system prompt stays byte-identical across same-type targets (T1.4 cache property)', () => {
    const a = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide).system;
    const b = buildGenerationPrompt({ type: 'hero', niche: 'restaurant', style: 'bold', designKey: 'Bella' }, guide).system;
    expect(a).toBe(b);
  });
});

describe('design bar rewrite', () => {
  it('demands commitment + hero/thumbnail heuristics; drops the blanket rounded+soft-shadow mandate', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(heroTarget, guide);
    expect(prompt).toMatch(/catalog thumbnail/i);
    expect(prompt).toMatch(/~?400px/);
    expect(prompt).not.toContain('rounded corners + soft shadows where cards appear');
  });
});

describe('cards directive surface swap', () => {
  const cardsTarget: Target = {
    type: 'cards', niche: 'saas', style: 'minimal',
    variant: { group: 'cards-saas-minimal', columns: 3, icons: 'top', iconStyle: 'circle' },
  };

  it('when languages are ON the hardcoded card surface is replaced by a design-system reference', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(cardsTarget, guide);
    expect(prompt).toContain('3 equal-width card columns'); // structure stays
    expect(prompt).toContain('card/panel treatment from the page design system'); // surface defers
    expect(prompt).not.toContain('rounded corners (decoration.border.radius ~20px)'); // old surface gone
  });

  it('when OFF the legacy card surface text returns byte-for-byte', () => {
    process.env.DESIGN_LANGUAGES = '0';
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(cardsTarget, guide);
    expect(prompt).toContain('rounded corners (decoration.border.radius ~20px)');
  });
});

describe('photography directive (phase 2)', () => {
  it('the language directive carries the photography line with append-keywords instruction', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(heroTarget, guide);
    expect(prompt).toMatch(/Photography: /);
    expect(prompt).toMatch(/APPEND these tags .* to every image keyword/i);
  });

  it('DESIGN_LANGUAGES=0 removes the photography line too', () => {
    process.env.DESIGN_LANGUAGES = '0';
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    const { prompt } = buildGenerationPrompt(heroTarget, guide);
    expect(prompt).not.toMatch(/Photography: /);
  });
});
