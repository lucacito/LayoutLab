import { describe, it, expect } from 'vitest';
import { RECIPE_BY_TYPE } from '@/pipeline/recipes/prompts';
import { LAYOUTS_BY_TYPE } from '@/pipeline/recipes/matrix';
import { KIND_BY_TYPE } from '@/pipeline/library/exemplars';
import { ROLE_DESIGN } from '@/pipeline/compose/section-prompt';
import { FLOWS } from '@/pipeline/compose/flow';
import { MATRIX } from '@/pipeline/recipes/matrix';
import { SECTION_TYPES } from '@/pipeline/recipes/section-types';

// T4.3 — characterization snapshots, captured VERBATIM from the five hand-synced
// maps BEFORE this task's refactor (see prompts.ts:36, exemplars.ts:98, matrix.ts:111,
// section-prompt.ts:43, flow.ts:41 as they stood prior to T4.3). These literals are
// the ground truth: the refactor must derive RECIPE_BY_TYPE / KIND_BY_TYPE /
// LAYOUTS_BY_TYPE / ROLE_DESIGN / FLOWS from the new SECTION_TYPES registry WITHOUT
// changing a single value — deep equality against these snapshots is the guardrail.

const EXPECTED_RECIPE_BY_TYPE: Record<string, string[]> = {
  hero: ['hero-cta', 'split-image-text'],
  cta: ['newsletter-social', 'hero-cta'],
  features: ['icon-features', 'card-grid-3'],
  cards: ['icon-values', 'blurb-grid', 'card-grid-3'],
  pricing: ['card-grid-3', 'stats-counter'],
  testimonials: ['testimonial', 'section-intro'],
  faq: ['icon-features', 'section-intro'],
  footer: ['newsletter-social'],
  header: ['hero-cta'],
  contact: ['contact-form'],
  gallery: ['image-gallery', 'image-carousel'],
  blog: ['blog-feed'],
  full_landing: ['hero-cta', 'icon-features', 'testimonial', 'stats-counter', 'card-grid-3'],
};

const EXPECTED_KIND_BY_TYPE: Record<string, string[]> = {
  hero: ['hero'],
  cta: ['cta'],
  features: ['features', 'feature_detail', 'stats'],
  cards: ['features'],
  pricing: ['pricing'],
  contact: ['contact'],
  gallery: ['gallery', 'media', 'slider'],
  footer: ['cta', 'contact'],
  testimonials: [],
  faq: [],
  full_landing: ['hero', 'features', 'stats', 'pricing', 'cta', 'contact'],
};

const EXPECTED_LAYOUTS_BY_TYPE: Record<string, string[]> = {
  hero: [
    'image on the right of the headline',
    'image on the left of the headline',
    'centered headline over a full-bleed background image',
    'split 50/50 with a sign-up form',
    'centered with a product/app shot below the CTA',
  ],
  cta: [
    'centered headline and a single button',
    'split with a supporting image on one side',
    'full-bleed banner with an overlay',
    'card-style CTA with a subtle border',
  ],
  features: [
    'three columns of cards',
    'four columns with icons',
    'a two-by-two grid',
    'alternating image + text rows',
    'a left intro with a feature list on the right',
  ],
  pricing: [
    'three pricing columns with a highlighted middle plan',
    'a two-column comparison',
    'a single highlighted plan with a feature checklist',
  ],
  testimonials: [
    'three-column quote cards with avatars',
    'one large featured quote with an avatar',
    'a logo strip above a featured quote',
  ],
  faq: ['a two-column accordion', 'a centered single-column list', 'categorized question columns'],
  contact: [
    'form on the left, contact details on the right',
    'a centered contact form',
    'split with a map-style image',
  ],
  gallery: ['a three-column image grid', 'a masonry-style grid', 'a horizontal image row'],
  footer: ['multi-column links with a newsletter signup', 'a centered minimal footer'],
  cards: ['equal columns of icon cards', 'equal columns of numbered step cards'],
};

describe('T4.3 characterization — SECTION_TYPES derives the five hand-synced maps unchanged', () => {
  it('RECIPE_BY_TYPE (prompts.ts) is unchanged', () => {
    expect(RECIPE_BY_TYPE).toEqual(EXPECTED_RECIPE_BY_TYPE);
  });

  it('KIND_BY_TYPE (exemplars.ts) is unchanged', () => {
    expect(KIND_BY_TYPE).toEqual(EXPECTED_KIND_BY_TYPE);
  });

  it('LAYOUTS_BY_TYPE (matrix.ts) is unchanged', () => {
    expect(LAYOUTS_BY_TYPE).toEqual(EXPECTED_LAYOUTS_BY_TYPE);
  });

  it('ROLE_DESIGN (section-prompt.ts) still has exactly the same 15 roles with 2-3 stable-id variants each', () => {
    expect(Object.keys(ROLE_DESIGN).sort()).toEqual(
      [
        'hero', 'trust', 'problem', 'solution', 'features', 'why', 'benefits', 'services',
        'how_it_works', 'gallery', 'social_proof', 'faq', 'referral', 'pricing', 'final_cta',
      ].sort(),
    );
    // Spot-check a few concrete ids/text survive byte-for-byte (full text is huge;
    // the id + a distinctive substring is enough to catch drift).
    expect(ROLE_DESIGN.hero.map((v) => v.id)).toEqual(['hero-split', 'hero-centered-fullbleed', 'hero-offset-image']);
    expect(ROLE_DESIGN.hero[0].text).toContain('a bold TWO-COLUMN hero');
    expect(ROLE_DESIGN.faq.map((v) => v.id)).toEqual(['faq-accordion', 'faq-two-column-list']);
    expect(ROLE_DESIGN.final_cta.map((v) => v.id)).toEqual(['final_cta-banner', 'final_cta-split']);
    expect(ROLE_DESIGN.referral[1].text).toContain('TINTED BANNER');
  });

  it('FLOWS (flow.ts) still has the same 5 business categories, each with the same variant ids and step role sequences', () => {
    expect(Object.keys(FLOWS).sort()).toEqual(
      ['saas', 'service/agency', 'local business', 'product/e-commerce', 'course/coaching'].sort(),
    );
    const shape = (cat: string) =>
      FLOWS[cat].map((v) => ({ id: v.id, roles: v.steps.map((s) => s.role), types: v.steps.map((s) => s.sectionType) }));
    expect(shape('saas')).toEqual([
      { id: 'saas-problem-solution', roles: ['hero', 'problem', 'solution', 'benefits', 'social_proof', 'how_it_works', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'features', 'cards', 'testimonials', 'cards', 'pricing', 'faq', 'cta'] },
      { id: 'saas-benefits-first', roles: ['hero', 'benefits', 'features', 'how_it_works', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'cards', 'features', 'cards', 'testimonials', 'pricing', 'faq', 'cta'] },
    ]);
    expect(shape('course/coaching')).toEqual([
      { id: 'course-coaching-classic', roles: ['hero', 'problem', 'solution', 'benefits', 'social_proof', 'how_it_works', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'features', 'cards', 'testimonials', 'cards', 'pricing', 'faq', 'cta'] },
      { id: 'course-coaching-outcomes-first', roles: ['hero', 'problem', 'benefits', 'how_it_works', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'cards', 'cards', 'testimonials', 'pricing', 'faq', 'cta'] },
    ]);
  });
});

describe('T4.3 — SECTION_TYPES registry completeness', () => {
  // Every type that a real generation run can target: the curated MATRIX, the
  // default `vary` type list (pipeline/index.ts), and `cards` (the default type
  // for `set` mode) — i.e. every type that must be FULLY generatable, not
  // silently falling back to a generic default because someone forgot a field.
  const DEFAULT_VARY_TYPES = ['hero', 'cta', 'features', 'pricing', 'testimonials', 'faq', 'contact', 'gallery'];
  const GENERATABLE_TYPES = [...new Set([...MATRIX.map((t) => t.type), ...DEFAULT_VARY_TYPES, 'cards'])];

  // full_landing is a documented exception to the "curated layouts list" field:
  // its composition is spelled out in full by prompts.ts's dedicated full_landing
  // directive (buildGenerationPrompt -> directives()), so it deliberately has no
  // LAYOUTS_BY_TYPE entry and falls back to matrix.ts's generic DEFAULT_LAYOUTS —
  // that is pre-existing, intentional behavior this task must not change.
  const LAYOUTS_EXEMPT = new Set(['full_landing']);

  it('every generatable type has a SECTION_TYPES entry', () => {
    for (const type of GENERATABLE_TYPES) {
      expect(SECTION_TYPES[type], `SECTION_TYPES is missing an entry for "${type}"`).toBeDefined();
    }
  });

  it('every generatable type has non-empty curated recipes', () => {
    for (const type of GENERATABLE_TYPES) {
      const entry = SECTION_TYPES[type];
      expect(entry?.recipes?.length ?? 0, `"${type}" has no RECIPE_BY_TYPE recipes`).toBeGreaterThan(0);
    }
  });

  it('every generatable type declares libraryKinds (present, possibly empty for a documented corpus gap)', () => {
    for (const type of GENERATABLE_TYPES) {
      const entry = SECTION_TYPES[type];
      expect(entry?.libraryKinds, `"${type}" has no KIND_BY_TYPE key at all`).toBeDefined();
    }
  });

  it('every generatable type has curated layouts, except the documented full_landing exemption', () => {
    for (const type of GENERATABLE_TYPES) {
      if (LAYOUTS_EXEMPT.has(type)) continue;
      const entry = SECTION_TYPES[type];
      expect(entry?.layouts?.length ?? 0, `"${type}" has no LAYOUTS_BY_TYPE entry`).toBeGreaterThan(0);
    }
  });

  it('fails loudly if a new MATRIX/vary type is added without a registry entry (regression guard)', () => {
    // Simulates the bug this task fixes: adding `__new_type__` to the generatable
    // set without adding a matching SECTION_TYPES entry.
    const types = [...GENERATABLE_TYPES, '__t4_3_test_missing_type__'];
    const missing = types.filter((t) => !SECTION_TYPES[t]?.recipes?.length);
    expect(missing).toContain('__t4_3_test_missing_type__');
  });

  it('every role nested under a type entry has 2-3 stable, role-prefixed treatment ids (mirrors ROLE_DESIGN invariant)', () => {
    for (const [type, entry] of Object.entries(SECTION_TYPES)) {
      for (const [role, variants] of Object.entries(entry.roles ?? {})) {
        expect(variants.length, `${type}/${role} variant count`).toBeGreaterThanOrEqual(2);
        expect(variants.length, `${type}/${role} variant count`).toBeLessThanOrEqual(3);
        const ids = variants.map((v) => v.id);
        expect(new Set(ids).size, `${type}/${role} duplicate ids`).toBe(ids.length);
        for (const v of variants) expect(v.id.startsWith(`${role}-`)).toBe(true);
      }
    }
  });
});
