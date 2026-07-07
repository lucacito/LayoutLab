// T1.4 — CLI-compatible prompt hygiene.
//
// Two things are under test:
// 1. The STABLE grounding (schema + style guide + the curated recipe examples
//    for a target's TYPE) moves into the appended system prompt, which the
//    `claude` CLI caches automatically when it's byte-identical across calls —
//    so it must depend ONLY on (target.type, guide), never on niche/style/color/
//    variant. The target-specific ask (type/niche/style, directives, retrieved
//    library exemplars) stays in the user prompt, which must NOT re-embed the
//    full schema/style text.
// 2. The content-ban list has exactly one source of truth (`bannedContentProse`
//    in pipeline/content-lint.ts) — both the generation directive and the
//    content-repair prompt derive their ban prose from it, so they can't drift.
import { describe, it, expect, afterEach } from 'vitest';
import { buildGenerationPrompt, buildRepairPrompt, buildContentRepairPrompt, type Guide } from '@/pipeline/recipes/prompts';
import type { Target } from '@/pipeline/recipes/matrix';
import { bannedContentProse } from '@/pipeline/content-lint';

const guide: Guide = {
  style: 'STYLE GUIDE TEXT xyz',
  schema: 'SCHEMA TEXT xyz',
  recipes: [
    { name: 'hero-cta', title: 'Hero', description: 'top of page', when: 'hero', markup: 'HERO_MARKUP_XYZ' },
    { name: 'contact-form', title: 'Contact', description: 'lead capture', when: 'contact', markup: 'CONTACT_MARKUP_XYZ' },
  ],
};

afterEach(() => {
  delete process.env.PROMPT_GROUNDING_IN_SYSTEM;
});

describe('stable system prompt (grounding split)', () => {
  it('the system prompt carries the schema, style guide, and the type-matched recipe', () => {
    const { system } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(system).toContain('SCHEMA TEXT xyz');
    expect(system).toContain('STYLE GUIDE TEXT xyz');
    expect(system).toContain('HERO_MARKUP_XYZ');
  });

  it('the user prompt does NOT re-embed the schema or style guide', () => {
    const { prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(prompt).not.toContain('SCHEMA TEXT xyz');
    expect(prompt).not.toContain('STYLE GUIDE TEXT xyz');
  });

  it('the user prompt carries the target-specific ask and directives', () => {
    const { prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(prompt).toContain('hero');
    expect(prompt).toContain('saas');
    expect(prompt).toContain('minimal');
    expect(prompt).toContain('Design bar');
  });

  it('the system prompt is BYTE-IDENTICAL across targets that share a type (cache-hit invariant)', () => {
    const a = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal', color: 'blue' }, guide).system;
    const b = buildGenerationPrompt({ type: 'hero', niche: 'restaurant', style: 'bold', color: 'red', layout: 'image right' }, guide).system;
    expect(a).toBe(b);
  });

  it('the user prompt still varies across targets that share a type', () => {
    const a = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide).prompt;
    const b = buildGenerationPrompt({ type: 'hero', niche: 'restaurant', style: 'bold' }, guide).prompt;
    expect(a).not.toBe(b);
  });

  it('the system prompt differs across different target types (different recipe grounding)', () => {
    const hero = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide).system;
    const contact = buildGenerationPrompt({ type: 'contact', niche: 'saas', style: 'minimal' }, guide).system;
    expect(hero).not.toBe(contact);
    expect(hero).toContain('HERO_MARKUP_XYZ');
    expect(contact).toContain('CONTACT_MARKUP_XYZ');
  });

  it('escape hatch: PROMPT_GROUNDING_IN_SYSTEM=0 reverts grounding to the user prompt', () => {
    process.env.PROMPT_GROUNDING_IN_SYSTEM = '0';
    const { system, prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(system).not.toContain('SCHEMA TEXT xyz');
    expect(system).not.toContain('STYLE GUIDE TEXT xyz');
    expect(prompt).toContain('SCHEMA TEXT xyz');
    expect(prompt).toContain('STYLE GUIDE TEXT xyz');
    expect(prompt).toContain('HERO_MARKUP_XYZ');
  });
});

describe('repair prompts reuse the same stable system prompt (cache hit on repair calls too)', () => {
  const target: Target = { type: 'hero', niche: 'saas', style: 'minimal' };

  it('buildRepairPrompt system matches buildGenerationPrompt system for the same target+guide', () => {
    const gen = buildGenerationPrompt(target, guide).system;
    const repair = buildRepairPrompt('{"bad":1}', [{ code: 'E_X', message: 'bad', path: 'a.b' }], target, guide).system;
    expect(repair).toBe(gen);
  });

  it('buildContentRepairPrompt system matches buildGenerationPrompt system for the same target+guide', () => {
    const gen = buildGenerationPrompt(target, guide).system;
    const repair = buildContentRepairPrompt('{"bad":1}', [{ code: 'LOREM_IPSUM', message: 'm', sample: 's' }], target, guide).system;
    expect(repair).toBe(gen);
  });
});

describe('image guide grounding (T3.3)', () => {
  const guideWithImageGuide: Guide = { ...guide, imageGuide: 'IMAGE_GUIDE_MARKER_TEXT loremflickr.com/{w}/{h}/{kw}?lock={n}' };

  it('folds the image guide into the stable system grounding when present', () => {
    const { system } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guideWithImageGuide);
    expect(system).toContain('IMAGE_GUIDE_MARKER_TEXT');
    expect(system).toContain('=== IMAGE GUIDE ===');
  });

  it('the per-call directive references the image guide when it is present', () => {
    const { prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guideWithImageGuide);
    expect(prompt.toLowerCase()).toContain('image guide');
    expect(prompt).toContain('aspect ratio');
  });

  it('is a no-op (system + directive unchanged) when guide.imageGuide is absent — fail-soft', () => {
    const withoutImageGuide = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(withoutImageGuide.system).not.toContain('=== IMAGE GUIDE ===');
    expect(withoutImageGuide.prompt.toLowerCase()).not.toContain('image guide');
  });

  it('repair prompts reuse the same system prompt including the folded image guide (cache hit)', () => {
    const target: Target = { type: 'hero', niche: 'saas', style: 'minimal' };
    const gen = buildGenerationPrompt(target, guideWithImageGuide).system;
    const repair = buildRepairPrompt('{"bad":1}', [{ code: 'E_X', message: 'bad', path: 'a.b' }], target, guideWithImageGuide).system;
    expect(repair).toBe(gen);
    expect(repair).toContain('IMAGE_GUIDE_MARKER_TEXT');
  });

  // Review fix follow-up: the T1.4 cache-hit invariant ("system prompt is
  // BYTE-IDENTICAL across targets that share a type") was only exercised
  // without an image guide. Extend it: with guide.imageGuide present, the
  // system prompt must STILL be a pure function of (target.type, guide) —
  // i.e. still byte-identical across varying niche/style/color for a shared
  // type — since stableGroundingBlock folds imageGuide in as guide-level
  // (not target-level) content.
  it('the system prompt is BYTE-IDENTICAL across targets that share a type, with an image guide present too', () => {
    const a = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal', color: 'blue' }, guideWithImageGuide).system;
    const b = buildGenerationPrompt(
      { type: 'hero', niche: 'restaurant', style: 'bold', color: 'red', layout: 'image right' },
      guideWithImageGuide,
    ).system;
    expect(a).toBe(b);
    expect(a).toContain('IMAGE_GUIDE_MARKER_TEXT');
  });
});

describe('content-ban single source of truth', () => {
  it('bannedContentProse() is non-empty and every entry appears in the generation directive', () => {
    const prose = bannedContentProse();
    expect(prose.length).toBeGreaterThan(0);
    const { prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    for (const p of prose) expect(prompt).toContain(p);
  });

  it('every banned-content entry also appears in the content-repair prompt', () => {
    const prose = bannedContentProse();
    const { prompt } = buildContentRepairPrompt(
      '{"post_content":"x"}',
      [{ code: 'LOREM_IPSUM', message: 'lorem', sample: 'lorem ipsum' }],
      { type: 'hero', niche: 'saas', style: 'minimal' },
      guide,
    );
    for (const p of prose) expect(prompt).toContain(p);
  });
});
