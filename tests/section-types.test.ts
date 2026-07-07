import { describe, it, expect } from 'vitest';
import { RECIPE_BY_TYPE } from '@/pipeline/recipes/prompts';
import { LAYOUTS_BY_TYPE } from '@/pipeline/recipes/matrix';
import { KIND_BY_TYPE } from '@/pipeline/library/exemplars';
import { ROLE_DESIGN } from '@/pipeline/compose/section-prompt';
import { FLOWS } from '@/pipeline/compose/flow';
import { MATRIX } from '@/pipeline/recipes/matrix';
import { SECTION_TYPES, buildUniqueRecord } from '@/pipeline/recipes/section-types';

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

// Full ROLE_DESIGN characterization: every one of the 15 roles' variant id LIST
// (ids AND order), captured verbatim from the pre-refactor flat literal (same
// source as EXPECTED_RECIPE_BY_TYPE etc. above) — a reviewer hand-verified these
// are drift-free against the current SECTION_TYPES registry before freezing them
// here. Spot-checking 4/15 roles (the pre-fix state) let a role's id list drift
// silently; this checks all 15.
const EXPECTED_ROLE_DESIGN_IDS: Record<string, string[]> = {
  hero: ['hero-split', 'hero-centered-fullbleed', 'hero-offset-image'],
  trust: ['trust-strip', 'trust-logo-row'],
  problem: ['problem-icon-row', 'problem-callout'],
  solution: ['solution-split', 'solution-before-after'],
  features: ['features-split', 'features-icon-grid'],
  why: ['why-split', 'why-icon-row'],
  benefits: ['benefits-image-cards', 'benefits-numbered-list'],
  services: ['services-image-cards', 'services-icon-tabs'],
  how_it_works: ['how_it_works-numbered-badges', 'how_it_works-timeline'],
  gallery: ['gallery-grid', 'gallery-featured-mosaic'],
  social_proof: ['social_proof-cards', 'social_proof-featured-quote'],
  faq: ['faq-accordion', 'faq-two-column-list'],
  referral: ['referral-split', 'referral-tinted-banner'],
  pricing: ['pricing-cards', 'pricing-aligned-comparison'],
  final_cta: ['final_cta-banner', 'final_cta-split'],
};

// Full FLOWS characterization: every one of the 5 business categories, all
// variant ids, and the FULL step role/type sequence per variant (not just
// saas + course/coaching) — captured verbatim from the pre-refactor S(role,
// sectionType, ...) calls in flow.ts, hand-verified drift-free before freezing.
const EXPECTED_FLOWS: Record<string, Array<{ id: string; roles: string[]; types: string[] }>> = {
  saas: [
    { id: 'saas-problem-solution', roles: ['hero', 'problem', 'solution', 'benefits', 'social_proof', 'how_it_works', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'features', 'cards', 'testimonials', 'cards', 'pricing', 'faq', 'cta'] },
    { id: 'saas-benefits-first', roles: ['hero', 'benefits', 'features', 'how_it_works', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'cards', 'features', 'cards', 'testimonials', 'pricing', 'faq', 'cta'] },
  ],
  'service/agency': [
    { id: 'service-agency-classic', roles: ['hero', 'problem', 'benefits', 'how_it_works', 'social_proof', 'faq', 'final_cta'], types: ['hero', 'features', 'cards', 'cards', 'testimonials', 'faq', 'cta'] },
    { id: 'service-agency-proof-led', roles: ['hero', 'social_proof', 'benefits', 'how_it_works', 'features', 'faq', 'final_cta'], types: ['hero', 'testimonials', 'cards', 'cards', 'features', 'faq', 'cta'] },
  ],
  'local business': [
    { id: 'local-business-classic', roles: ['hero', 'benefits', 'features', 'social_proof', 'faq', 'final_cta'], types: ['hero', 'cards', 'features', 'testimonials', 'faq', 'cta'] },
    { id: 'local-business-howto', roles: ['hero', 'how_it_works', 'benefits', 'social_proof', 'faq', 'final_cta'], types: ['hero', 'cards', 'cards', 'testimonials', 'faq', 'cta'] },
  ],
  'product/e-commerce': [
    { id: 'product-ecommerce-classic', roles: ['hero', 'problem', 'benefits', 'features', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'cards', 'features', 'testimonials', 'pricing', 'faq', 'cta'] },
    { id: 'product-ecommerce-benefits-first', roles: ['hero', 'benefits', 'features', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'cards', 'features', 'testimonials', 'pricing', 'faq', 'cta'] },
  ],
  'course/coaching': [
    { id: 'course-coaching-classic', roles: ['hero', 'problem', 'solution', 'benefits', 'social_proof', 'how_it_works', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'features', 'cards', 'testimonials', 'cards', 'pricing', 'faq', 'cta'] },
    { id: 'course-coaching-outcomes-first', roles: ['hero', 'problem', 'benefits', 'how_it_works', 'social_proof', 'pricing', 'faq', 'final_cta'], types: ['hero', 'features', 'cards', 'cards', 'testimonials', 'pricing', 'faq', 'cta'] },
  ],
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

  it('ROLE_DESIGN (section-prompt.ts) still has exactly the same 15 roles, each with the same variant ids in the same order', () => {
    expect(Object.keys(ROLE_DESIGN).sort()).toEqual(Object.keys(EXPECTED_ROLE_DESIGN_IDS).sort());
    for (const [role, ids] of Object.entries(EXPECTED_ROLE_DESIGN_IDS)) {
      expect(ROLE_DESIGN[role]?.map((v) => v.id), `ROLE_DESIGN.${role} ids`).toEqual(ids);
    }
    // Spot-check a couple of concrete text bodies survive byte-for-byte too (full
    // text is huge; the id list above plus a distinctive substring here is enough
    // to catch content drift on top of the id/order drift the loop above catches).
    expect(ROLE_DESIGN.hero[0].text).toContain('a bold TWO-COLUMN hero');
    expect(ROLE_DESIGN.referral[1].text).toContain('TINTED BANNER');
  });

  it('FLOWS (flow.ts) still has the same 5 business categories, each with the same variant ids and FULL step role/type sequences', () => {
    expect(Object.keys(FLOWS).sort()).toEqual(Object.keys(EXPECTED_FLOWS).sort());
    const shape = (cat: string) =>
      FLOWS[cat].map((v) => ({ id: v.id, roles: v.steps.map((s) => s.role), types: v.steps.map((s) => s.sectionType) }));
    for (const [category, expected] of Object.entries(EXPECTED_FLOWS)) {
      expect(shape(category), `FLOWS['${category}']`).toEqual(expected);
    }
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

describe('T4.3 — buildUniqueRecord guards the role-key collision', () => {
  // Both ROLE_TO_TYPE (section-types.ts) and ROLE_DESIGN's flatten
  // (section-prompt.ts) build a Record by flattening per-type role maps with
  // Object.fromEntries — last-wins on a duplicate key, so a future type entry
  // that accidentally reuses a role name already declared under another type
  // would silently corrupt both derived maps with no signal. buildUniqueRecord
  // is the shared guard: it throws instead of silently overwriting. Exercised
  // here against synthetic pairs — never against the real SECTION_TYPES
  // registry — per the task's "don't mutate the real registry" constraint.

  it('builds a Record unchanged when every key is unique (control case)', () => {
    const result = buildUniqueRecord(
      [
        ['hero', 'a'],
        ['problem', 'b'],
      ],
      'test map',
    );
    expect(result).toEqual({ hero: 'a', problem: 'b' });
  });

  it('throws a clear error when a synthetic duplicate role key is constructed across two type entries', () => {
    expect(() =>
      buildUniqueRecord(
        [
          ['hero', 'from-type-a'],
          ['trust', 'from-type-a'],
          ['hero', 'from-type-b'], // duplicate — simulates two SECTION_TYPES entries both declaring "hero"
        ],
        'test map',
      ),
    ).toThrow(/duplicate key "hero"/);
  });
});
