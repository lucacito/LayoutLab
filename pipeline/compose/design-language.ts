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

/** Photography art direction (rich-generator spec §5.6). The REAL lever:
 *  pipeline/images.ts resolves the model's image keywords into live Pexels
 *  searches, so `styleWords` (mechanically appended to every keyword) provably
 *  reach the photo search. `framing`/`subjects` steer what the model asks for;
 *  `usage` steers how images sit in the layout. No CSS-filter field — Pexels
 *  photos are pre-graded (deliberate YAGNI deviation from spec §5.6).
 *  Multi-word styleWords are hyphenated at directive-build time: images.ts's
 *  placeholder regex is whitespace-delimited (a literal space would truncate
 *  the URL), while resolveImages converts hyphens back to spaces for the
 *  Pexels query — so hyphenation is lossless. */
export interface PhotoDirection {
  /** Lowercase words appended to every image keyword, e.g. ['candid', 'natural light']. */
  styleWords: string[];
  framing: string;
  subjects: string;
  usage: 'full-bleed-overlay' | 'framed-panels' | 'mosaic';
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
  /** Optional per-variant photography override, merged over the language default. */
  photography?: Partial<PhotoDirection>;
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
  photography: PhotoDirection;
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
    photography: {
      styleWords: ['bright', 'clean'],
      framing: 'wide, airy compositions with room around the subject',
      subjects: 'real people using products and clean workspace scenes, not posed stock',
      usage: 'framed-panels',
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
    photography: {
      styleWords: ['documentary', 'natural light'],
      framing: 'environmental wide shots with negative space suitable for text',
      subjects: 'people mid-task in real settings, reportage feel',
      usage: 'framed-panels',
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
    photography: {
      styleWords: ['vibrant', 'high contrast'],
      framing: 'tight dynamic crops with strong diagonals and energy',
      subjects: 'action moments and bold product shots with saturated color',
      usage: 'full-bleed-overlay',
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
      'glass cards on dark panels: a semi-transparent rgba(255,255,255,0.06) background + a 1px rgba(255,255,255,0.12) hairline border + ~20px radius set on ALL FOUR corners',
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
    photography: {
      styleWords: ['moody', 'dark'],
      framing: 'low-key compositions with deep shadows and a single light source',
      subjects: 'dramatic product and atmosphere shots that stay legible under overlays',
      usage: 'full-bleed-overlay',
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
    photography: {
      styleWords: ['high contrast', 'graphic'],
      framing: 'frontal, flat-on compositions with hard edges and strong geometry',
      subjects: 'stark objects and unposed people, no soft lifestyle gloss',
      usage: 'framed-panels',
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
    photography: {
      styleWords: ['moody', 'low key'],
      framing: 'close-up textures and details with generous negative space',
      subjects: 'materials, craftsmanship, and quiet interiors that read as premium',
      usage: 'mosaic',
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
  const photo = { ...language.photography, ...(variant.photography ?? {}) };
  // Hyphenate multi-word style words for URL safety: images.ts's placeholder
  // regex stops at whitespace, and its Pexels resolution turns hyphens back
  // into spaces — see the PhotoDirection JSDoc.
  const tags = photo.styleWords.map((w) => w.replace(/\s+/g, '-'));
  return [
    `Page design system (${language.id}/${variant.id}) — commit to it FULLY and use it consistently in every module:`,
    `Typography: headlines in ${variant.display}; body text in ${variant.body}; eyebrows/kickers ${variant.eyebrow}. ` +
      `Sizes: H1 ${language.scale.h1}; H2 ${language.scale.h2}; eyebrow ${language.scale.eyebrow}; body ${language.scale.body}. ` +
      `Set these with the font decoration attributes (family, weight, size, letterSpacing, style) documented in the style guide.`,
    `Buttons: ${language.buttons}.`,
    `Cards/panels: ${language.cardSurface}.`,
    `Spacing: section padding ${language.scale.sectionPaddingY} top/bottom; card padding ${language.scale.cardPadding}; grid gaps ${language.scale.gridGap}.`,
    `Photography: ${photo.subjects}; ${photo.framing}; use images as ${photo.usage.replace(/-/g, ' ')}. ` +
      `APPEND these tags (comma-separated, exactly as written) to every image keyword URL you write — they steer the real photo search: ${tags.join(', ')}.`,
  ].join('\n');
}
