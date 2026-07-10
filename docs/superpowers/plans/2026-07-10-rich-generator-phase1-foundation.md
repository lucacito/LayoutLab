# Rich Generator Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every generated page a deterministic, distinctive design system (typography, buttons, card surfaces, numeric scales) selected from 6 curated design languages, unlock the STYLE.md styling vocabulary the prompts currently forbid, and port the button-centering fixes as a pipeline lint — verified by an eval A/B.

**Architecture:** A new `DESIGN_LANGUAGES` registry (`pipeline/compose/design-language.ts`) mirrors the `STYLE_PALETTES` pattern: typed data + `pickByRendezvous` selection, but keyed with a high-entropy discriminator (`brief.businessName` for composed pages via a new `Target.designKey` field; `variant.group` or `color|layout` for vary targets) so two same-(style,niche) pages get different design systems. Language prose is injected in ONE place — `directives()` in `prompts.ts` (the funnel both generation paths share) — keeping the T1.4 prompt-cache layout intact (static digest → system block; per-target prose → user prompt). A new `pipeline/design-lint.ts` ports the prod-proven button-centering transforms as a deterministic post-generation step next to `stackLayoutJsonMobile`.

**Tech Stack:** TypeScript, Vitest, existing pipeline modules (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-10-rich-generator-design-languages-design.md` (v2), Phase 1 scope only.

## Global Constraints

- **No `Math.random` / `Date.now()`** anywhere new — all selection via `pickByRendezvous` on stable string keys with hand-assigned ids (append-stability: never derive ids from array position, never rename existing ids).
- **Validator untouched.** No new block types, no invented attribute paths. All styling references must map to shapes documented in the validator repo's `docs/STYLE.md` or the recipes.
- **Prompt-cache layout preserved (T1.4):** anything added to `stableGroundingBlock`/system prompt must be a pure function of `(target.type, guide)` — byte-identical across same-type targets. Per-target prose (language directives) goes in the user prompt only.
- **`DESIGN_LANGUAGES` env knob:** default ON; `DESIGN_LANGUAGES=0` disables language injection (escape hatch, same pattern as `PROMPT_GROUNDING_IN_SYSTEM`). The grounding unlock + design-bar rewrite are unconditional.
- **Ownership rule (spec §4):** language fields describe surface/typography/buttons/scale — never section structure. Role treatments keep structure only (fully enforced in Phase 3; Phase 1 must not ADD surface prose to treatments).
- Path alias `@/` = repo root (see existing imports like `@/pipeline/recipes`). Tests live in `tests/*.test.ts`, run with `npx vitest run tests/<file>.test.ts`.
- Commit after every task (small, green commits).

---

### Task 1: Rendezvous extraction + design-language registry and selection

**Files:**
- Create: `pipeline/rendezvous.ts`
- Create: `pipeline/compose/design-language.ts`
- Modify: `pipeline/compose/palettes.ts` (extract `hashString`/`pickByRendezvous`, re-export)
- Test: `tests/design-language.test.ts`

**Interfaces:**
- Consumes: nothing new (moves `pickByRendezvous` verbatim).
- Produces (used by Tasks 2–3):
  - `pipeline/rendezvous.ts`: `export function pickByRendezvous<T extends { id: string }>(key: string, items: readonly T[]): T`
  - `pipeline/compose/design-language.ts`:
    - `export interface DesignLanguage { id: string; eligibleStyles: string[]; cardSurface: string; buttons: string; scale: NumericScale; variants: LanguageVariant[] }`
    - `export interface LanguageVariant { id: string; display: string; body: string; eyebrow: string }`
    - `export interface NumericScale { sectionPaddingY: string; h1: string; h2: string; eyebrow: string; body: string; cardPadding: string; gridGap: string }`
    - `export const DESIGN_LANGUAGES: DesignLanguage[]`
    - `export function designLanguagesEnabled(): boolean` — `process.env.DESIGN_LANGUAGES !== '0'`
    - `export function designDiscriminator(t: { designKey?: string; variant?: { group: string }; color?: string; layout?: string }): string`
    - `export function selectDesignLanguage(t: { style?: string; niche?: string } & Parameters<typeof designDiscriminator>[0]): { language: DesignLanguage; variant: LanguageVariant }`
    - `export function selectDesignLanguageId(t): string` and `export function selectLanguageVariantId(t): string` (test/snapshot helpers, mirroring `selectPaletteVariantId`)
    - `export function buildLanguageDirective(language: DesignLanguage, variant: LanguageVariant): string`

**Why the extraction:** `prompts.ts` (in `recipes/`) will need rendezvous selection, but importing `compose/palettes.ts` from `recipes/` creates an import cycle (`palettes → brief → @/pipeline/recipes → prompts`). `pipeline/rendezvous.ts` is a leaf module with zero imports; `palettes.ts` re-exports it so every existing import site (`compose/section-prompt.ts`, tests) keeps working unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/design-language.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickByRendezvous } from '@/pipeline/rendezvous';
import { pickByRendezvous as reExported } from '@/pipeline/compose/palettes';
import {
  DESIGN_LANGUAGES,
  buildLanguageDirective,
  designDiscriminator,
  designLanguagesEnabled,
  selectDesignLanguage,
  selectDesignLanguageId,
  selectLanguageVariantId,
} from '@/pipeline/compose/design-language';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('rendezvous extraction', () => {
  it('palettes re-exports the same pickByRendezvous', () => {
    expect(reExported).toBe(pickByRendezvous);
  });
});

describe('DESIGN_LANGUAGES registry', () => {
  it('has 6 languages with globally unique language and variant ids', () => {
    expect(DESIGN_LANGUAGES).toHaveLength(6);
    const langIds = DESIGN_LANGUAGES.map((l) => l.id);
    expect(new Set(langIds).size).toBe(6);
    const variantIds = DESIGN_LANGUAGES.flatMap((l) => l.variants.map((v) => v.id));
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it('every language has >=2 variants and complete prose/scale fields', () => {
    for (const l of DESIGN_LANGUAGES) {
      expect(l.variants.length).toBeGreaterThanOrEqual(2);
      expect(l.cardSurface.length).toBeGreaterThan(20);
      expect(l.buttons.length).toBeGreaterThan(20);
      for (const key of ['sectionPaddingY', 'h1', 'h2', 'eyebrow', 'body', 'cardPadding', 'gridGap'] as const) {
        expect(l.scale[key], `${l.id}.scale.${key}`).toMatch(/\d/); // numeric, not adjectives
      }
      for (const v of l.variants) {
        expect(v.display.length).toBeGreaterThan(2);
        expect(v.body.length).toBeGreaterThan(2);
        expect(v.eyebrow.length).toBeGreaterThan(5);
      }
    }
  });

  it('covers every catalog style with >=2 languages, and every language is reachable', () => {
    const styles: string[] = AXIS_VALUES.style;
    for (const s of styles) {
      const eligible = DESIGN_LANGUAGES.filter((l) => l.eligibleStyles.includes(s));
      expect(eligible.length, `style "${s}"`).toBeGreaterThanOrEqual(2);
    }
    for (const l of DESIGN_LANGUAGES) {
      expect(l.eligibleStyles.some((s) => styles.includes(s)), `language "${l.id}" unreachable`).toBe(true);
    }
  });

  it('ownership rule: language prose never dictates section structure', () => {
    // Coarse word-list guard (spec §4/§7): surface fields must not smuggle in
    // structural instructions that belong to role treatments.
    const banned = /\b(timeline|numbered step|accordion|three columns|two columns|testimonial)\b/i;
    for (const l of DESIGN_LANGUAGES) {
      expect(l.cardSurface).not.toMatch(banned);
      expect(l.buttons).not.toMatch(banned);
    }
  });
});

describe('selection', () => {
  it('is deterministic: same inputs -> same language + variant', () => {
    const t = { style: 'minimal', niche: 'saas', designKey: 'Acme Analytics' };
    expect(selectDesignLanguageId(t)).toBe(selectDesignLanguageId({ ...t }));
    expect(selectLanguageVariantId(t)).toBe(selectLanguageVariantId({ ...t }));
  });

  it('respects the style eligibility gate', () => {
    for (const s of AXIS_VALUES.style as string[]) {
      const { language } = selectDesignLanguage({ style: s, niche: 'saas', designKey: 'k' });
      expect(language.eligibleStyles).toContain(s);
    }
  });

  it('variant belongs to the selected language', () => {
    const t = { style: 'bold', niche: 'fitness', designKey: 'PulseGrid' };
    const { language, variant } = selectDesignLanguage(t);
    expect(language.variants.map((v) => v.id)).toContain(variant.id);
  });

  it('ENTROPY REGRESSION (spec §5.3): same (style,niche), different discriminators -> more than one language', () => {
    // The v1 flaw: style|niche alone gave every Healthcare+Corporate page ONE
    // language forever. With the discriminator, 20 different business names
    // must spread across >=2 languages (deterministically).
    const ids = new Set(
      Array.from({ length: 20 }, (_, i) =>
        selectDesignLanguageId({ style: 'corporate', niche: 'real_estate', designKey: `Business ${i}` }),
      ),
    );
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('unknown style falls back without throwing', () => {
    const { language } = selectDesignLanguage({ style: 'nonexistent', niche: 'saas', designKey: 'k' });
    expect(language).toBeDefined();
  });
});

describe('designDiscriminator', () => {
  it('prefers designKey, then variant.group, then color|layout', () => {
    expect(designDiscriminator({ designKey: 'Acme', variant: { group: 'g' }, color: 'c', layout: 'l' })).toBe('Acme');
    expect(designDiscriminator({ variant: { group: 'cards-saas-minimal' }, color: 'c', layout: 'l' })).toBe('cards-saas-minimal');
    expect(designDiscriminator({ color: 'warm', layout: 'three columns' })).toBe('warm|three columns');
    expect(designDiscriminator({})).toBe('|');
  });
});

describe('buildLanguageDirective', () => {
  it('emits the full system: id, typography, scale numbers, buttons, cards, spacing', () => {
    const { language, variant } = selectDesignLanguage({ style: 'minimal', niche: 'saas', designKey: 'Acme' });
    const d = buildLanguageDirective(language, variant);
    expect(d).toContain(`${language.id}/${variant.id}`);
    expect(d).toContain(variant.display);
    expect(d).toContain(language.scale.h1);
    expect(d).toContain(language.buttons);
    expect(d).toContain(language.cardSurface);
    expect(d).toContain(language.scale.sectionPaddingY);
  });
});

describe('designLanguagesEnabled', () => {
  it('defaults on; DESIGN_LANGUAGES=0 disables', () => {
    const prev = process.env.DESIGN_LANGUAGES;
    delete process.env.DESIGN_LANGUAGES;
    expect(designLanguagesEnabled()).toBe(true);
    process.env.DESIGN_LANGUAGES = '0';
    expect(designLanguagesEnabled()).toBe(false);
    if (prev === undefined) delete process.env.DESIGN_LANGUAGES;
    else process.env.DESIGN_LANGUAGES = prev;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design-language.test.ts`
Expected: FAIL — `Cannot find module '@/pipeline/rendezvous'` (and design-language).

- [ ] **Step 3: Create `pipeline/rendezvous.ts`** (move the two functions VERBATIM from `pipeline/compose/palettes.ts:82-113`, including both doc comments):

```ts
// Deterministic string hash (FNV-1a), NOT randomness — same input string always
// hashes to the same number, so re-running the pipeline (idempotent/resumable,
// see buildVariants in recipes/matrix.ts) always assigns the same pick to the
// same key. No Date.now/Math.random anywhere in this module.
//
// Extracted from pipeline/compose/palettes.ts (Phase 1, rich-generator spec) so
// modules in pipeline/recipes/ can use rendezvous selection without importing
// compose/ (which would cycle: palettes -> brief -> @/pipeline/recipes).
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Rendezvous (Highest Random Weight) hashing: deterministically pick ONE item from
 *  `items` for a given `key`, scoring each item by `hash(key + ':' + item.id)` and
 *  taking the max. This is the append-stable alternative to `hash(key) % items.length`:
 *  with modulo indexing, adding or removing a single bucket entry reshuffles almost
 *  every key's assignment (the divisor changes), silently breaking resumability —
 *  a previously-generated (style, niche) landing would get a different palette on
 *  the next pipeline run for a target that already has content. With rendezvous
 *  hashing, appending a new item only steals the keys for which that new item now
 *  scores highest; every key that keeps losing to its original winner is untouched
 *  (see the append-stability test in tests/compose-palettes.test.ts). Never derive
 *  `item.id` from array position — it must be a stable, hand-assigned string. */
export function pickByRendezvous<T extends { id: string }>(key: string, items: readonly T[]): T {
  let best = items[0];
  let bestScore = -1;
  for (const item of items) {
    const score = hashString(`${key}:${item.id}`);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
```

- [ ] **Step 4: Update `pipeline/compose/palettes.ts`** — delete its local `hashString` and `pickByRendezvous` definitions (lines 78–113) and add at the top:

```ts
import { pickByRendezvous } from '@/pipeline/rendezvous';

// Re-exported so existing import sites (compose/section-prompt.ts, tests) are
// unchanged — the implementation moved to pipeline/rendezvous.ts (leaf module)
// so recipes/ can use it without an import cycle.
export { pickByRendezvous };
```

- [ ] **Step 5: Create `pipeline/compose/design-language.ts`:**

```ts
// pipeline/compose/design-language.ts — per-page DESIGN LANGUAGES (Phase 1 of
// the rich-generator spec, docs/superpowers/specs/2026-07-10-rich-generator-
// design-languages-design.md).
//
// A design language owns the SURFACE of a page: typography, buttons, card/panel
// treatment, and a NUMERIC scale (sizes/spacing as numbers, not adjectives —
// LLMs follow numbers far more reliably). It deliberately does NOT own section
// STRUCTURE (role treatments in recipes/section-types.ts do) nor copy voice
// (the brief does) — the ownership matrix in spec §4.
//
// Selection mirrors STYLE_PALETTES (palettes.ts): pickByRendezvous over
// hand-assigned stable ids, so append-stability and resumability hold. Unlike
// palettes, the key carries a high-entropy DISCRIMINATOR (designDiscriminator
// below) so two pages sharing (style, niche) still get different design
// systems — the spec's §5.3 entropy fix. Every field is prompt-ready prose or
// a numeric range; buildLanguageDirective assembles the block that
// prompts.ts's directives() injects into the USER prompt (never the cached
// system grounding — T1.4).
import { pickByRendezvous } from '@/pipeline/rendezvous';

export interface NumericScale {
  /** Section top/bottom padding range, e.g. '96-128px'. */
  sectionPaddingY: string;
  h1: string;
  h2: string;
  eyebrow: string;
  body: string;
  cardPadding: string;
  gridGap: string;
}

/** A typography variant within a language. `id` is the append-stability anchor
 *  for pickByRendezvous — hand-assigned, never derived from array position. */
export interface LanguageVariant {
  id: string;
  /** Display/heading font + flavor, e.g. 'Fraunces (a modern display serif)'. */
  display: string;
  /** Body font. */
  body: string;
  /** Eyebrow/kicker treatment. */
  eyebrow: string;
}

export interface DesignLanguage {
  id: string;
  /** Style-axis gate (AXIS_VALUES.style values this language suits). */
  eligibleStyles: string[];
  /** Card/panel surface prose. Surface ONLY — no section structure. */
  cardSurface: string;
  /** Primary/secondary button system prose. */
  buttons: string;
  scale: NumericScale;
  variants: LanguageVariant[];
}

export const DESIGN_LANGUAGES: DesignLanguage[] = [
  {
    id: 'soft-saas',
    eligibleStyles: ['minimal', 'corporate', 'playful'],
    cardSurface:
      'white (or gently tinted, on colored panels) cards with rounded corners (~16px radius) and ONE soft diffuse box shadow; on hover the card lifts (transform translateY about -6px, a slightly deeper shadow, smooth transition)',
    buttons:
      'rounded-rectangle buttons (~10px radius): the primary solid in the accent color, the secondary a lighter tinted or outlined version of the same accent',
    scale: {
      sectionPaddingY: '88-120px',
      h1: '48-64px, weight 700, tight line-height (~1.1)',
      h2: '32-40px, weight 700',
      eyebrow: '13px, weight 600',
      body: '16-17px, line-height ~1.6',
      cardPadding: '32-36px',
      gridGap: '28-32px',
    },
    variants: [
      { id: 'soft-saas-inter', display: 'Inter (clean geometric sans)', body: 'Inter', eyebrow: 'accent-colored, sentence case' },
      { id: 'soft-saas-jakarta', display: 'Plus Jakarta Sans (friendly geometric sans)', body: 'Inter', eyebrow: 'uppercase, letterspaced 1.5px, accent-colored' },
    ],
  },
  {
    id: 'editorial',
    eligibleStyles: ['minimal', 'corporate', 'elegant'],
    cardSurface:
      'flat panels with a 1px hairline border in a muted neutral, NO box shadows, sharp corners (0-4px radius) — print-like restraint',
    buttons:
      'sharp rectangular buttons (0px radius): the primary solid in the accent color; the secondary a ghost button (1px border, transparent background)',
    scale: {
      sectionPaddingY: '112-150px',
      h1: '56-76px, weight 600, very tight line-height (~1.02)',
      h2: '38-48px, weight 600',
      eyebrow: '12-13px, uppercase, letterspaced 2-3px',
      body: '17-18px, line-height ~1.65',
      cardPadding: '28-36px',
      gridGap: '32-40px',
    },
    variants: [
      { id: 'editorial-fraunces', display: 'Fraunces (a modern display serif)', body: 'Inter', eyebrow: 'uppercase, letterspaced 3px, muted neutral color' },
      { id: 'editorial-playfair', display: 'Playfair Display (high-contrast serif)', body: 'Source Sans 3', eyebrow: 'uppercase, letterspaced 2px, accent-colored' },
    ],
  },
  {
    id: 'bold-vibrant',
    eligibleStyles: ['bold', 'playful'],
    cardSurface:
      'high-energy cards on subtly accent-tinted or gradient surfaces, large radii (~24px), with a COLORED glow box shadow (a shadow in the accent color at low opacity) instead of a gray one',
    buttons:
      'pill buttons (fully rounded, ~50px radius): the primary solid accent with a soft accent-colored glow shadow; the secondary an outlined pill',
    scale: {
      sectionPaddingY: '80-112px',
      h1: '52-72px, weight 800, very tight line-height (~1.05)',
      h2: '34-44px, weight 800',
      eyebrow: '13px, uppercase, letterspaced 2px, weight 700',
      body: '16-17px, line-height ~1.6',
      cardPadding: '32-40px',
      gridGap: '24-32px',
    },
    variants: [
      { id: 'bold-vibrant-grotesk', display: 'Space Grotesk (techy display sans)', body: 'Inter', eyebrow: 'uppercase, letterspaced 2px, accent-colored' },
      { id: 'bold-vibrant-archivo', display: 'Archivo (condensed, heavy)', body: 'Inter', eyebrow: 'uppercase, letterspaced 1.5px, on a small accent chip' },
    ],
  },
  {
    id: 'glass-dark',
    eligibleStyles: ['dark', 'elegant'],
    cardSurface:
      'glass cards on dark panels: a semi-transparent rgba(255,255,255,0.06) background + a 1px rgba(255,255,255,0.12) hairline border + ~20px radius set on ALL FOUR corners; most sections lean dark with light text',
    buttons:
      'the primary a solid accent button (~12px radius); the secondary a glass button (translucent surface + 1px hairline border, light text)',
    scale: {
      sectionPaddingY: '96-128px',
      h1: '52-68px, weight 700, tight line-height (~1.08)',
      h2: '34-42px, weight 700',
      eyebrow: '12-13px, uppercase, letterspaced 2px',
      body: '16-17px, line-height ~1.65',
      cardPadding: '32-40px',
      gridGap: '28-36px',
    },
    variants: [
      { id: 'glass-dark-outfit', display: 'Outfit (rounded geometric sans)', body: 'Inter', eyebrow: 'uppercase, letterspaced 2px, accent-colored' },
      { id: 'glass-dark-sora', display: 'Sora (sharp technical sans)', body: 'Inter', eyebrow: 'sentence case, accent-colored, weight 600' },
    ],
  },
  {
    id: 'brutalist-flat',
    eligibleStyles: ['bold', 'dark'],
    cardSurface:
      'flat color blocks with THICK 2px solid borders in the heading color, ZERO box shadows, 0px radius everywhere — raw, graphic, unapologetic',
    buttons:
      'sharp 0px-radius buttons with 2px solid borders: the primary solid accent with a heading-color border; the secondary transparent with a 2px heading-color border',
    scale: {
      sectionPaddingY: '72-104px',
      h1: '56-80px, weight 900, uppercase, very tight line-height (~1.0)',
      h2: '36-48px, weight 900, uppercase',
      eyebrow: '12px, uppercase, letterspaced 3px, weight 700',
      body: '16-17px, line-height ~1.55',
      cardPadding: '24-32px',
      gridGap: '16-24px',
    },
    variants: [
      { id: 'brutalist-archivo-black', display: 'Archivo Black (ultra-heavy)', body: 'IBM Plex Sans', eyebrow: 'uppercase, letterspaced 3px, on a small solid accent block' },
      { id: 'brutalist-grotesk-mono', display: 'Space Grotesk (heavy weights)', body: 'IBM Plex Sans', eyebrow: 'IBM Plex Mono, uppercase, letterspaced 2px' },
    ],
  },
  {
    id: 'luxe',
    eligibleStyles: ['elegant', 'minimal'],
    cardSurface:
      'ivory or softly tinted panels with a thin 1px border in a muted warm neutral, subtle ~6px radius, and NO heavy shadows (at most a very faint, barely-there one) — whitespace itself is the decoration',
    buttons:
      'thin-bordered buttons (1px border, 2-4px radius) with letterspaced (1.5-2px) uppercase labels; the primary may be solid in the accent, the secondary always outlined',
    scale: {
      sectionPaddingY: '120-160px',
      h1: '52-72px, weight 500, elegant line-height (~1.1)',
      h2: '34-44px, weight 500',
      eyebrow: '12px, uppercase, letterspaced 3px',
      body: '17-18px, line-height ~1.7',
      cardPadding: '36-48px',
      gridGap: '36-48px',
    },
    variants: [
      { id: 'luxe-cormorant', display: 'Cormorant Garamond (refined serif)', body: 'Outfit', eyebrow: 'uppercase, letterspaced 3px, muted gold/neutral tone' },
      { id: 'luxe-marcellus', display: 'Marcellus (classical inscriptional serif)', body: 'Outfit', eyebrow: 'uppercase, letterspaced 2.5px, accent-colored' },
    ],
  },
];

const FALLBACK_STYLE = 'minimal';

/** Escape hatch, same pattern as PROMPT_GROUNDING_IN_SYSTEM (prompts.ts):
 *  default ON; DESIGN_LANGUAGES=0 reverts to the pre-language prompts so the
 *  eval harness can A/B the two. */
export function designLanguagesEnabled(): boolean {
  return process.env.DESIGN_LANGUAGES !== '0';
}

/** The high-entropy part of the selection key (spec §5.3). Priority:
 *  1. designKey — set by compose/index.ts to brief.businessName, so every
 *     section of one composed page shares one language (page cohesion), while
 *     two briefs for the same (style, niche) get different ones. For a
 *     GENERATED (non-pinned) brief the name varies across re-runs — acceptable:
 *     covered targets are never re-generated (planTargets skips them), and
 *     pinned briefs (themes) are fully stable. See the deliberate
 *     "NOT keyed on businessName" note on FLOW selection in compose/index.ts —
 *     that concern is structural determinism; surface variety tolerates it.
 *  2. variant.group — buildVariantSet siblings (Columns 2/3/4, icon styles)
 *     share a group, so cross-linked variants keep ONE design system.
 *  3. color|layout — buildVariants gives each vary target a distinct pair. */
export function designDiscriminator(t: {
  designKey?: string;
  variant?: { group: string };
  color?: string;
  layout?: string;
}): string {
  return t.designKey ?? t.variant?.group ?? `${t.color ?? ''}|${t.layout ?? ''}`;
}

function languageKey(t: { style?: string; niche?: string } & Parameters<typeof designDiscriminator>[0]): string {
  return `${t.style ?? ''}|${t.niche ?? ''}|${designDiscriminator(t)}`;
}

function eligibleFor(style: string | undefined): DesignLanguage[] {
  const eligible = DESIGN_LANGUAGES.filter((l) => l.eligibleStyles.includes(style ?? ''));
  return eligible.length ? eligible : DESIGN_LANGUAGES.filter((l) => l.eligibleStyles.includes(FALLBACK_STYLE));
}

/** Deterministically select the page's design language + typography variant.
 *  Pure function of (style, niche, discriminator) — no RNG. Append-stable via
 *  pickByRendezvous over hand-assigned ids. */
export function selectDesignLanguage(
  t: { style?: string; niche?: string } & Parameters<typeof designDiscriminator>[0],
): { language: DesignLanguage; variant: LanguageVariant } {
  const key = languageKey(t);
  const language = pickByRendezvous(key, eligibleFor(t.style));
  const variant = pickByRendezvous(key, language.variants);
  return { language, variant };
}

/** Snapshot/test helpers, mirroring selectPaletteVariantId (palettes.ts). */
export function selectDesignLanguageId(t: Parameters<typeof selectDesignLanguage>[0]): string {
  return selectDesignLanguage(t).language.id;
}
export function selectLanguageVariantId(t: Parameters<typeof selectDesignLanguage>[0]): string {
  return selectDesignLanguage(t).variant.id;
}

/** The prompt block injected by directives() (prompts.ts) — USER prompt only,
 *  never the cached system grounding (T1.4). One block, fixed field order, so
 *  golden snapshots and word-ownership tests have a stable shape to hold onto. */
export function buildLanguageDirective(language: DesignLanguage, variant: LanguageVariant): string {
  return [
    `Page design system (${language.id}/${variant.id}) — commit to it FULLY and use it consistently in every module:`,
    `Typography: headlines in ${variant.display}; body text in ${variant.body}; eyebrows/kickers ${variant.eyebrow}. ` +
      `Sizes: H1 ${language.scale.h1}; H2 ${language.scale.h2}; eyebrow ${language.scale.eyebrow}; body ${language.scale.body}. ` +
      `Set these with the font decoration attributes (family, weight, size, letterSpacing, style) documented in the style guide.`,
    `Buttons: ${language.buttons}.`,
    `Cards/panels: ${language.cardSurface}.`,
    `Spacing: section padding ${language.scale.sectionPaddingY} top/bottom; card padding ${language.scale.cardPadding}; grid gaps ${language.scale.gridGap}.`,
  ].join('\n');
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/design-language.test.ts tests/compose-palettes.test.ts tests/compose-section-prompt.test.ts`
Expected: ALL PASS (the two existing suites prove the palettes extraction broke nothing).

- [ ] **Step 7: Pin selection snapshots** — append to `tests/design-language.test.ts` inside `describe('selection', ...)`:

```ts
  it('pins concrete selections (append-stability tripwire, like compose-palettes)', () => {
    const picks = [
      { style: 'minimal', niche: 'saas', designKey: 'Acme Analytics' },
      { style: 'corporate', niche: 'real_estate', designKey: 'Harborline Group' },
      { style: 'elegant', niche: 'coaching', designKey: 'Maison Verity' },
      { style: 'bold', niche: 'fitness', designKey: 'PulseGrid' },
    ].map((t) => `${selectDesignLanguageId(t)}/${selectLanguageVariantId(t)}`);
    expect(picks).toMatchInlineSnapshot();
  });
```

Run: `npx vitest run tests/design-language.test.ts` — vitest FILLS the empty `toMatchInlineSnapshot()` on first run and passes. Re-run to confirm stable. (The filled values become the pinned regression data — commit them.)

- [ ] **Step 8: Commit**

```bash
git add pipeline/rendezvous.ts pipeline/compose/design-language.ts pipeline/compose/palettes.ts tests/design-language.test.ts
git commit -m "feat(pipeline): design-language registry + entropy-keyed deterministic selection"
```

---

### Task 2: Grounding unlock + language injection in generation prompts

**Files:**
- Modify: `pipeline/recipes/matrix.ts:4-14` (add `designKey` to `Target`)
- Modify: `pipeline/recipes/prompts.ts` (SYSTEM at :50-55, `stableGroundingBlock` at :95-116, `directives()` at :128-214)
- Test: `tests/design-language-prompts.test.ts` (new); existing `tests/cards-prompt.test.ts` must stay green

**Interfaces:**
- Consumes (Task 1): `designLanguagesEnabled()`, `selectDesignLanguage(t)`, `buildLanguageDirective(language, variant)` from `@/pipeline/compose/design-language`.
- Produces: `Target.designKey?: string` (Task 3 sets it for composed sections); prompts now carry the language block.

- [ ] **Step 1: Write the failing test**

Create `tests/design-language-prompts.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/design-language-prompts.test.ts`
Expected: FAIL (no `Page design system` block, old SYSTEM text, no digest).

- [ ] **Step 3: Add `designKey` to `Target`** in `pipeline/recipes/matrix.ts` — insert after the `variant` field (line 13):

```ts
  /** Design-system selection discriminator (rich-generator spec §5.3): set by
   *  compose/index.ts to brief.businessName so every section of one composed
   *  page shares ONE design language. Absent on vary targets — selection falls
   *  back to variant.group, then color|layout (see designDiscriminator in
   *  compose/design-language.ts). NOT part of targetKey (coverage identity is
   *  unchanged). */
  designKey?: string;
```

- [ ] **Step 4: Implement the prompts.ts changes.**

4a. Import (top of `pipeline/recipes/prompts.ts`):

```ts
import { buildLanguageDirective, designLanguagesEnabled, selectDesignLanguage } from '@/pipeline/compose/design-language';
```

4b. Replace the `SYSTEM` const (lines 50–55) with:

```ts
const SYSTEM =
  'You generate Divi 5 page sections as a single JSON document. ' +
  'You MUST follow the provided Divi 5 schema and style guide exactly: use ONLY ' +
  'block/module types shown in the example recipes, and style them with decoration ' +
  'attribute shapes documented in the STYLE GUIDE and recipes — never invent block ' +
  'types or new attribute paths. Keep the JSON inside every Divi block comment strictly valid. ' +
  'Respond with ONLY the JSON document, no prose.';
```

4c. Add the STYLING MOVES digest const (below `SYSTEM`) and append it inside `stableGroundingBlock` right after the STYLE GUIDE part (it is STATIC text — a pure function of nothing — so the block stays byte-identical per type and cache-eligible):

```ts
// Static digest of the advanced, validator-legal styling moves the STYLE GUIDE
// documents but generations habitually ignore (rich-generator spec §5.7). Part
// of the STABLE grounding block: pure static text, so the T1.4 cache property
// (byte-identical system prompt per target type) is preserved.
const STYLING_MOVES =
  '=== STYLING MOVES (all documented in the STYLE GUIDE above — use them deliberately) ===\n' +
  'Premium moves available to you, each with exact attribute paths in the style guide: ' +
  'multi-stop background gradients (including gradient-over-image with overlaysImage); ' +
  'box-shadow presets 1-5 including COLORED glow shadows; transform.translate offsets for ' +
  'overlapping/offset elements; CSS filters (brightness/contrast/saturate/blur) including hover states; ' +
  'glassmorphism (semi-transparent rgba surface + 1px hairline border + radius set on all four corners); ' +
  'absolute position + z-index for layered badges and decorations; per-corner border radii; ' +
  'any Google font with weight/letterSpacing/uppercase via the font decoration attributes; ' +
  'divi/divider rules; hover decorations (.hover. replacing .value. on the same path). ' +
  'Choose the moves that fit the page design system — never invent attribute paths not shown ' +
  'in the STYLE GUIDE or recipes.';
```

In `stableGroundingBlock`, change the `parts` array to insert the digest after the style guide:

```ts
  const parts = [
    '=== DIVI 5 SCHEMA ===',
    guide.schema,
    '',
    '=== STYLE GUIDE ===',
    guide.style,
    '',
    STYLING_MOVES,
    '',
    '=== VALID SECTION RECIPES (copy the structure + attribute shapes; write your own copy) ===',
    recipeExamples.join('\n\n'),
  ];
```

4d. In `directives(target, guide)`, add the language block right after the layout-robustness `lines.push(...)` (i.e. before the `if (target.color)` line):

```ts
  // Rich-generator spec §5.1/§5.3: the page's deterministic design system.
  // USER prompt only (varies per target) — never the cached system grounding.
  if (designLanguagesEnabled()) {
    const { language, variant } = selectDesignLanguage(target);
    lines.push(buildLanguageDirective(language, variant));
  }
```

4e. Still in `directives()`, make the cards surface language-driven — replace the first `lines.push(...)` inside `if (target.type === 'cards')` (the sentence at line 148–150 containing `rounded corners (decoration.border.radius ~20px)`) with:

```ts
    if (designLanguagesEnabled()) {
      lines.push(
        `Build a section of ${cols} equal-width card columns. Each card IS the divi/column, styled as the wrapper ` +
          `using EXACTLY the card/panel treatment from the page design system above (surface, border/radius, shadow, ` +
          `card padding) — plus a subtle hover lift or hover accent consistent with that system.`,
      );
    } else {
      lines.push(
        `Build a section of ${cols} equal-width card columns. Each card IS the divi/column, styled as the wrapper: a white (or, for dark/colored sets, a tinted) background, rounded corners (decoration.border.radius ~20px), generous padding (~36px), and a soft box shadow. On hover the card lifts — set the column's hover decoration: transform translate Y about -6px plus a deeper box shadow and a smooth transition.`,
      );
    }
```

4f. Replace the "Design bar" `lines.push(...)` (lines 185–191) with (unconditional — this is the grounding unlock, not the language system):

```ts
  lines.push(
    'Design bar (this is a premium marketplace — every section must look like it was crafted by a senior designer): ' +
      'commit FULLY to one clear aesthetic direction and carry it through every module — never a generic default; ' +
      'strong typographic hierarchy (large, tight display headlines vs comfortable body sizes), deliberate spacing, ' +
      'one accent color carried through buttons, icons, and highlights, and hover polish on interactive elements. ' +
      'The FIRST/HERO section sells the layout — it is the catalog thumbnail, so give it the strongest treatment on the page. ' +
      'Design for thumbnail legibility: buyers first see this at ~400px wide, so compose one dominant contrast block ' +
      'and a clear macro-composition that reads at that size. ' +
      'Style everything using decoration attribute shapes documented in the STYLE GUIDE and recipes — never invent new attribute paths.',
  );
```

- [ ] **Step 5: Run the new test + the full prompt-related suites**

Run: `npx vitest run tests/design-language-prompts.test.ts tests/cards-prompt.test.ts tests/prompts.test.ts tests/pipeline-recipes.test.ts`
Expected: ALL PASS. (Verified while planning: the only old-text pins are `toContain('Design bar')` in `tests/prompts.test.ts:51` and `tests/pipeline-recipes.test.ts:95` — the rewritten design bar still starts with `Design bar (`, so they stay green. No existing test pins the old cards-surface sentence.) If anything else fails on prompt text, the legacy wording must only be asserted under `DESIGN_LANGUAGES=0`.

- [ ] **Step 6: Run the whole test suite**

Run: `npm run test`
Expected: PASS (fix any other prompt-text assertions the same way — legacy text lives behind the knob).

- [ ] **Step 7: Commit**

```bash
git add pipeline/recipes/matrix.ts pipeline/recipes/prompts.ts tests/design-language-prompts.test.ts tests/cards-prompt.test.ts
git commit -m "feat(pipeline): grounding unlock + design-language injection in generation prompts"
```

---

### Task 3: Composed-path wiring — designKey + role-treatment entropy + cohesion line swap

**Files:**
- Modify: `pipeline/compose/index.ts:134-140` (sectionTarget gains `designKey`)
- Modify: `pipeline/compose/section-prompt.ts` (`treatmentKey` at :60-62, `pickRoleTreatment`/`selectRoleTreatmentId` at :64-75, call at :110, cohesion sentence at :104)
- Test: `tests/compose-section-prompt.test.ts` (extend), `tests/compose-landing.test.ts` must stay green

**Interfaces:**
- Consumes: `Target.designKey` (Task 2).
- Produces: `selectRoleTreatmentId(role, ctx)` where `ctx` gains optional `businessName?: string` (backward-compatible — existing two-arg calls unchanged).

- [ ] **Step 1: Write the failing tests** — append to `tests/compose-section-prompt.test.ts`:

```ts
describe('rich-generator phase 1 (entropy + cohesion swap)', () => {
  const step = { role: 'benefits', sectionType: 'cards', job: 'j', cta: false } as const;
  const mkBrief = (businessName: string) => ({
    businessType: 'SaaS', businessName, tagline: 't', audience: 'a',
    conversionGoal: 'g', primaryCta: 'Start', accentColorHex: '#E4572E', voice: 'v',
  });

  it('drops the ONE-corner-radius mandate; defers to the page design system', () => {
    const p = buildSectionRolePrompt(step, mkBrief('Acme'), { style: 'minimal', niche: 'saas' });
    expect(p).not.toContain('Reuse ONE corner-radius');
    expect(p).toContain('page design system');
  });

  it('role-treatment entropy: same (style,niche), different businessName -> >=2 distinct treatments across 20 briefs', () => {
    const ids = new Set(
      Array.from({ length: 20 }, (_, i) =>
        selectRoleTreatmentId('benefits', { style: 'minimal', niche: 'saas', businessName: `Biz ${i}` }),
      ),
    );
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('treatment selection stays deterministic per businessName', () => {
    const ctx = { style: 'minimal', niche: 'saas', businessName: 'Acme' };
    expect(selectRoleTreatmentId('benefits', ctx)).toBe(selectRoleTreatmentId('benefits', { ...ctx }));
  });

  it('existing two-arg calls still work (backward compat)', () => {
    expect(selectRoleTreatmentId('benefits', { style: 'minimal', niche: 'saas' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/compose-section-prompt.test.ts`
Expected: FAIL — `Reuse ONE corner-radius` still present; `businessName` not part of the key (only 1 distinct treatment id).

- [ ] **Step 3: Implement `section-prompt.ts` changes.**

3a. Extend the key (replace `treatmentKey`, lines 54–62 — keep the doc comment and add to it):

```ts
/** Same base shape as `paletteKey` in palettes.ts (style + niche) PLUS the
 *  brief's businessName as a high-entropy discriminator (rich-generator spec
 *  §5.3): without it, every page sharing (style, niche) got the identical
 *  treatment sequence forever. businessName is stable within one composed page
 *  (the brief is generated once) — page cohesion holds; and covered targets
 *  are never re-generated, so cross-run brief variance is acceptable. Role is
 *  still NOT part of the key — each role's variant list is scored
 *  independently via its own variant ids (see `pickByRendezvous`). */
function treatmentKey(ctx: { style?: string; niche?: string; businessName?: string }): string {
  return `${ctx.style ?? ''}|${ctx.niche ?? ''}|${ctx.businessName ?? ''}`;
}
```

3b. Widen the ctx types on `pickRoleTreatment` (line 64) and `selectRoleTreatmentId` (line 73) to `{ style?: string; niche?: string; businessName?: string }` (same one-word change in both signatures).

3c. Thread the brief's name at the call site (line 110):

```ts
  const roleDesign = pickRoleTreatment(step.role, { style: ctx.style, niche: ctx.niche, businessName: brief.businessName });
```

3d. Replace the cohesion sentence — in the shared-design-system `lines` entry (line 104), change

`Reuse ONE corner-radius and ONE soft box-shadow for every card so the page feels systematic.`

to

`Follow the page design system given in this prompt (typography, buttons, card surfaces, spacing) EXACTLY — the same treatments in every section — so the page reads as one crafted design.`

- [ ] **Step 4: Set `designKey` in `compose/index.ts`** — the `sectionTarget` literal (lines 134–140) becomes:

```ts
    const sectionTarget: Target = {
      type: step.sectionType,
      niche: target.niche,
      style: target.style,
      color: target.color,
      // Rich-generator spec §5.3: ONE design language per composed page. Every
      // section shares the brief's businessName as the selection discriminator,
      // so directives() (prompts.ts) resolves the SAME language for all of them
      // — cohesion by construction. (Contrast the FLOW-selection key above,
      // which deliberately avoids businessName: structural determinism across
      // re-runs matters there; surface variety tolerates a generated brief's
      // name changing, because covered targets are never re-generated.)
      designKey: brief.businessName,
      layout: buildSectionRolePrompt(step, brief, { index, total: flow.length, style: target.style, niche: target.niche, landingBlueprint }) + brandFacts,
    };
```

- [ ] **Step 5: Run the compose suites**

Run: `npx vitest run tests/compose-section-prompt.test.ts tests/compose-landing.test.ts tests/compose-flow.test.ts`
Expected: PASS. If an existing assertion pins the old "Reuse ONE corner-radius" sentence, update it to the new sentence.

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add pipeline/compose/index.ts pipeline/compose/section-prompt.ts tests/compose-section-prompt.test.ts
git commit -m "feat(pipeline): one design language per composed page + role-treatment entropy"
```

---

### Task 4: Design lint — port the button-centering transforms into the pipeline

**Files:**
- Create: `pipeline/design-lint.ts`
- Modify: `pipeline/run.ts:709-712` (apply before `stackLayoutJsonMobile`)
- Test: `tests/design-lint.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–3 (independent; port of `scripts/patch-live-layout.ts:336-484`).
- Produces: `export function applyButtonCentering(layoutJson: string, log?: (m: string) => void): string` — deterministic, idempotent, fail-open (returns input on any parse problem).

Port notes (vs. the script): the script's transforms THROW when nothing changed (patch semantics: "nothing to change" is an operator error). As a pipeline lint they run on every layout, so "nothing to change" returns the input unchanged. Malformed-structure throws stay inside and are caught by the fail-open wrapper — a cosmetic fix must never drop a layout.

- [ ] **Step 1: Write the failing test**

Create `tests/design-lint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyButtonCentering } from '@/pipeline/design-lint';

const wrap = (post_content: string) => JSON.stringify({ post_title: 't', post_content });
const content = (json: string) => (JSON.parse(json) as { post_content: string }).post_content;

const BUTTON = '<!-- wp:divi/button {"button":{"innerContent":{"desktop":{"value":{"text":"Go"}}}}} /-->';
const CENTERED_COL_ATTRS = '{"module":{"advanced":{"text":{"text":{"desktop":{"value":{"orientation":"center"}}}}}}}';

const centeredColWithButton = wrap(
  `<!-- wp:divi/section {} --><!-- wp:divi/column ${CENTERED_COL_ATTRS} -->` +
    `<!-- wp:divi/text {} --><p>Hi</p><!-- /wp:divi/text -->${BUTTON}` +
    `<!-- /wp:divi/column --><!-- /wp:divi/section -->`,
);

describe('applyButtonCentering', () => {
  it('pass 1: a centered-text column containing a button becomes a centered flex column', () => {
    const out = content(applyButtonCentering(centeredColWithButton));
    expect(out).toContain('"display":"flex"');
    expect(out).toContain('"flexDirection":"column"');
    expect(out).toContain('"alignItems":"center"');
  });

  it('label pass: every button font gets textAlign:center', () => {
    const out = content(applyButtonCentering(centeredColWithButton));
    expect(out).toContain('"textAlign":"center"');
  });

  it('pass 2: a LONE-button column inside a centered section is centered too', () => {
    const loneButtonInCenteredSection = wrap(
      `<!-- wp:divi/section {} -->` +
        `<!-- wp:divi/column {} --><!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":{"text":"H"}}},"decoration":{}},"module":{"advanced":{"text":{"text":{"desktop":{"value":{"textAlign":"center"}}}}}}} /--><!-- /wp:divi/column -->` +
        `<!-- wp:divi/column {} -->${BUTTON}<!-- /wp:divi/column -->` +
        `<!-- /wp:divi/section -->`,
    );
    const out = content(applyButtonCentering(loneButtonInCenteredSection));
    // the lone-button column (second) must now be a centered flex column
    const secondCol = out.split('<!-- wp:divi/column ')[2];
    expect(secondCol).toContain('"alignItems":"center"');
  });

  it('leaves a left-aligned design\'s columns alone (labels only)', () => {
    const leftAligned = wrap(
      `<!-- wp:divi/section {} --><!-- wp:divi/column {} -->` +
        `<!-- wp:divi/text {} --><p>Left</p><!-- /wp:divi/text -->${BUTTON}` +
        `<!-- /wp:divi/column --><!-- /wp:divi/section -->`,
    );
    const out = content(applyButtonCentering(leftAligned));
    expect(out).not.toContain('"display":"flex"'); // no column change
    expect(out).toContain('"textAlign":"center"'); // labels still centered (prod-proven pass)
  });

  it('is idempotent', () => {
    const once = applyButtonCentering(centeredColWithButton);
    expect(applyButtonCentering(once)).toBe(once);
  });

  it('fails open: malformed post_content returns the input verbatim', () => {
    const malformed = wrap('<!-- wp:divi/column {"a":1} --> no close');
    expect(applyButtonCentering(malformed)).toBe(malformed);
    expect(applyButtonCentering('not json at all')).toBe('not json at all');
    expect(applyButtonCentering(JSON.stringify({ post_title: 'no content' }))).toBe(JSON.stringify({ post_title: 'no content' }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/design-lint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `pipeline/design-lint.ts`:**

```ts
// pipeline/design-lint.ts — deterministic post-generation design fixes
// (rich-generator spec §5.10). Phase 1 scope: the button-centering transforms
// proven in prod (66/193 published layouts patched via scripts/fix-buttons.sh
// -> scripts/patch-live-layout.ts PATCH_MODE=center-buttons/-lone-buttons;
// see memory layoutlab-button-centering), ported to run on every FRESH layout
// before render — so the flaw is fixed at the source instead of patched live.
//
// Differences from the patch script (deliberate):
//   - No-throw: the script throws "nothing to change" (patch semantics); a
//     lint runs on every layout, so unchanged input is simply returned.
//   - Fail-open: malformed structure returns the input verbatim (logged). A
//     cosmetic fix must never drop a validated layout.
//   - Idempotent: attributes already set are left untouched, so applying the
//     lint to its own output is a no-op (tested).
// Applied in run.ts right before stackLayoutJsonMobile — both are deterministic
// attribute-only transforms, so the content hash downstream stays stable for
// identical generations (idempotency/resumability preserved).
const COL_OPEN = '<!-- wp:divi/column ';
const COL_CLOSE = '<!-- /wp:divi/column -->';
const SEC_OPEN = '<!-- wp:divi/section';
const SEC_CLOSE = '<!-- /wp:divi/section -->';
const BUTTON_RE = /<!-- wp:divi\/button {.*?} \/-->/g;

type LayoutValue = { display?: string; flexDirection?: string; alignItems?: string };

function centeredFlex(attrs: Record<string, any>): boolean {
  const val: LayoutValue =
    ((((((attrs.module ??= {}).decoration ??= {}).layout ??= {}).desktop ??= {}).value ??= {}));
  if (val.display === 'flex' && val.alignItems === 'center') return false;
  val.display = 'flex';
  val.flexDirection = 'column';
  val.alignItems = 'center';
  return true;
}

// Pass 1 (port of centerButtons, scripts/patch-live-layout.ts:351): every
// column containing BOTH a button module AND a centered-text signal becomes a
// centered flex column. `orientation:center` never moves a block/inline-block
// button; this does.
function centerButtonColumns(c: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = c.indexOf(COL_OPEN, i);
    if (start < 0) { out += c.slice(i); break; }
    const jsonStart = start + COL_OPEN.length;
    const tagEnd = c.indexOf(' -->', jsonStart);
    if (tagEnd < 0) throw new Error('malformed column open tag');
    const close = c.indexOf(COL_CLOSE, tagEnd);
    if (close < 0) throw new Error('unclosed column');
    const attrsRaw = c.slice(jsonStart, tagEnd);
    const inner = c.slice(tagEnd + 4, close); // detection only; never rewritten here
    const hasButton = inner.includes('<!-- wp:divi/button ');
    const centered =
      attrsRaw.includes('"orientation":"center"') ||
      inner.includes('"orientation":"center"') ||
      inner.includes('"textAlign":"center"');
    let newAttrsRaw = attrsRaw;
    if (hasButton && centered) {
      const attrs = JSON.parse(attrsRaw);
      if (centeredFlex(attrs)) newAttrsRaw = JSON.stringify(attrs);
    }
    out += c.slice(i, start) + COL_OPEN + newAttrsRaw + ' -->';
    i = tagEnd + 4; // continue right after the open tag (handles any nesting)
  }
  return out;
}

// Pass 2 (port of centerLoneButtonColumns, scripts/patch-live-layout.ts:412):
// a button alone in its own column has no centered-text signal of its own —
// center it when its enclosing SECTION reads centered (measured with button
// modules stripped, so pass 3's textAlign can't count as a signal and
// left-aligned designs are left alone).
function centerLoneButtonColumns(c: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const sStart = c.indexOf(SEC_OPEN, i);
    if (sStart < 0) { out += c.slice(i); break; }
    const sEnd = c.indexOf(SEC_CLOSE, sStart);
    if (sEnd < 0) throw new Error('unclosed section');
    const secEnd = sEnd + SEC_CLOSE.length;
    let section = c.slice(sStart, secEnd);
    const nonButton = section.replace(BUTTON_RE, '');
    const sectionCentered =
      nonButton.includes('"orientation":"center"') || nonButton.includes('"textAlign":"center"');
    if (sectionCentered) {
      let secOut = '';
      let j = 0;
      for (;;) {
        const cStart = section.indexOf(COL_OPEN, j);
        if (cStart < 0) { secOut += section.slice(j); break; }
        const jsonStart = cStart + COL_OPEN.length;
        const tagEnd = section.indexOf(' -->', jsonStart);
        const cClose = section.indexOf(COL_CLOSE, tagEnd);
        if (tagEnd < 0 || cClose < 0) throw new Error('malformed column in section');
        const attrsRaw = section.slice(jsonStart, tagEnd);
        const inner = section.slice(tagEnd + 4, cClose);
        const loneButton =
          inner.includes('<!-- wp:divi/button ') && inner.replace(BUTTON_RE, '').trim() === '';
        let newAttrsRaw = attrsRaw;
        if (loneButton) {
          const attrs = JSON.parse(attrsRaw);
          if (centeredFlex(attrs)) newAttrsRaw = JSON.stringify(attrs);
        }
        secOut += section.slice(j, cStart) + COL_OPEN + newAttrsRaw + ' -->';
        j = tagEnd + 4;
      }
      section = secOut;
    }
    out += c.slice(i, sStart) + section;
    i = secEnd;
  }
  return out;
}

// Pass 3 (port of the shared label sub-fix / centerLabels): textAlign:center
// on every button font — a visual no-op for inline-block buttons, fixes the
// left-aligned wrapped label when a phone-stretched button goes full-width.
function centerButtonLabels(c: string): string {
  return c.replace(/<!-- wp:divi\/button ({.*?}) \/-->/g, (m, j: string) => {
    const attrs = JSON.parse(j);
    const val =
      (((((((attrs.button ??= {}).decoration ??= {}).font ??= {}).font ??= {}).desktop ??= {}).value ??= {}));
    if (val.textAlign === 'center') return m;
    val.textAlign = 'center';
    return '<!-- wp:divi/button ' + JSON.stringify(attrs) + ' /-->';
  });
}

/** Deterministic button-centering lint over a full layout JSON string
 *  ({ post_title, post_content }). Idempotent; fail-open (returns the input
 *  verbatim on any parse problem, optionally logging why). */
export function applyButtonCentering(layoutJson: string, log?: (m: string) => void): string {
  try {
    const obj = JSON.parse(layoutJson) as { post_content?: unknown };
    if (typeof obj.post_content !== 'string') return layoutJson;
    let pc = obj.post_content;
    pc = centerButtonColumns(pc);
    pc = centerLoneButtonColumns(pc);
    pc = centerButtonLabels(pc);
    if (pc === obj.post_content) return layoutJson;
    obj.post_content = pc;
    return JSON.stringify(obj);
  } catch (e) {
    log?.(`[design-lint] button centering skipped: ${e instanceof Error ? e.message : String(e)}`);
    return layoutJson;
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/design-lint.test.ts`
Expected: PASS. (If the idempotency test fails on JSON key order: `centeredFlex` returns `false` for already-set attrs so the raw string is reused — verify that short-circuit is intact.)

- [ ] **Step 5: Wire into `pipeline/run.ts`** — add the import at the top (next to `import { stackLayoutJsonMobile } from './stack-mobile';`):

```ts
import { applyButtonCentering } from './design-lint';
```

and at line ~709, immediately BEFORE the `json = stackLayoutJsonMobile(json);` line, add:

```ts
      // Deterministic design lint (fix-buttons port — rich-generator spec §5.10):
      // center CTA buttons in centered contexts + center every button label.
      // Attribute-only, idempotent, fail-open; like stack-mobile below it runs
      // BEFORE contentHash so identical generations still dedupe identically.
      json = applyButtonCentering(json, log);
```

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: PASS (run.ts tests exercise the pipeline with stub deps; the lint is a pure pass-through for content without buttons).

- [ ] **Step 7: Commit**

```bash
git add pipeline/design-lint.ts pipeline/run.ts tests/design-lint.test.ts
git commit -m "feat(pipeline): port button-centering fixes as deterministic post-gen design lint"
```

---

### Task 5: Verification + eval A/B validity check

**Files:**
- No new code. Runs the verification battery; the REAL A/B spends budget and is Lucas's call.

**Interfaces:**
- Consumes: everything above; `scripts/eval-generator.ts --env-var=<flag>` (existing generic A/B knob).

- [ ] **Step 1: Full local verification battery**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass/clean. Show the output.

- [ ] **Step 2: Eval-harness plumbing smoke (no budget)**

Run: `npx tsx scripts/eval-generator.ts --env-var=DESIGN_LANGUAGES --off-label=baseline --on-label=languages --dry-run`
Expected: completes; prints the side-by-side scoreboard for both configs with stubbed deps (validates that the knob toggles cleanly inside the harness).

Note the flag semantics: the harness's "off" config sets `DESIGN_LANGUAGES=0` (legacy prompts) and "on" sets `DESIGN_LANGUAGES=1` (default behavior) — confirm in the printed config header that both labels appear.

- [ ] **Step 3: REAL A/B run — STOP, requires Lucas's go-ahead (spends LLM budget, needs preflight)**

Preflight (memory: check-server-before-generating): dev server responding (`curl -sf http://localhost:3000/browse >/dev/null`) AND the render env up (validator repo `make up`, `curl -sf http://localhost:8181 >/dev/null`).

Then: `npx tsx scripts/eval-generator.ts --env-var=DESIGN_LANGUAGES --off-label=baseline --on-label=languages`

**Acceptance (spec §7/§11):** with languages ON vs baseline —
- `validatorPassRate` within 10 percentage points of baseline (richer prompts must not tank first-pass validity);
- `meanRepairAttempts` not more than +0.5 over baseline;
- eyeball the accepted layouts' renders (they land in the local catalog): confirm visibly distinct typography/buttons/cards across targets that share (style, niche).

If acceptance fails: keep `DESIGN_LANGUAGES=0` in production runs, file the failure modes (which languages/fields drive repairs), and iterate on the language prose — the knob makes this safe.

- [ ] **Step 4: Commit any assertion/documentation fixes and close out Phase 1**

```bash
git add -A && git commit -m "chore(pipeline): phase-1 eval A/B verification notes"
```

(Only if files changed; otherwise skip.)

---

## Self-review notes (run before handoff)

- **Spec coverage (Phase 1 list):** selection-entropy fix → Tasks 1–3; grounding unlock + design-bar rewrite (hero/thumbnail) → Task 2; minimal language records for all 6 → Task 1; fix-buttons lint port → Task 4; eval A/B → Task 5. ✔
- **Deliberately NOT in Phase 1** (spec Phases 2–5): icon catalog, PhotoDirection, motif/move registries, breakout/straddle, Layout DNA, art-direction contract, designScore, gold exemplars, `seo.designLanguage` persistence.
- **Type consistency:** `Target.designKey?: string` (Task 2) consumed by `designDiscriminator` (Task 1) and set in compose (Task 3); `selectRoleTreatmentId(role, ctx{style,niche,businessName?})` widened compatibly.
- **Known judgment calls encoded above:** language injection lives ONLY in `directives()` (single funnel; composed cohesion via `designKey`); `variant.group` keeps card-variant siblings on one design system; lint is fail-open and runs before `contentHash`.
