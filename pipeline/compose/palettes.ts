import type { Palette } from './brief';

/** Curated design-system palettes, keyed by style (`lib/catalog/filters.ts`
 *  `AXIS_VALUES.style`), with 2 hand-picked variants per style for niche-level
 *  variety. `primary` is deliberately NOT part of this shape — the brief's own
 *  `accentColorHex` always wins there (see selectPalette below); everything
 *  else (secondary/tint/dark/heading/body) comes from here so two different
 *  styles genuinely look different instead of one slate palette re-tinted.
 *
 *  Curation notes:
 *  - Sections in this pipeline alternate WHITE and TINT backgrounds (see
 *    `backgroundTone` in `section-prompt.ts`) for every style, including
 *    "dark" — only the final_cta/footer role actually sits on `dark`. That
 *    means heading/body must stay legible on BOTH white and the tint for
 *    every entry below, so all of them use a dark, readable heading/body —
 *    styles differ by HUE (cool slate, warm stone, navy, burgundy, etc.) and
 *    by tint/dark/secondary, not by making text unreadably light.
 *  - Every heading/body pair here was checked with `contrastRatio()` against
 *    both `#FFFFFF` and its own `tint` and clears WCAG AA's 4.5:1 normal-text
 *    minimum with real margin (the tightest pair in this set is ~7:1); see
 *    `tests/compose-palettes.test.ts` for the enforced gate.
 *  - `dark` is the deep panel color used for final_cta/footer sections — kept
 *    distinctly different per style (near-black warm stone, deep navy,
 *    near-black slate, deep plum, deep amber, deep indigo) so the closing
 *    banner reads as part of that style's system, not a shared generic navy.
 */
type StylePaletteBase = Omit<Palette, 'primary'>;

const STYLE_PALETTES: Record<string, StylePaletteBase[]> = {
  minimal: [
    // Cool slate — airy, neutral (closest to the original single default).
    { secondary: '#64748B', tint: '#F8FAFC', dark: '#0F172A', heading: '#0F172A', body: '#334155' },
    // Warm greige — airy but paper-like/warmer.
    { secondary: '#78716C', tint: '#FAF7F2', dark: '#292524', heading: '#292524', body: '#57534E' },
  ],
  bold: [
    // Vivid warm — punchy orange secondary, near-black text.
    { secondary: '#EA580C', tint: '#FFF7ED', dark: '#18181B', heading: '#18181B', body: '#3F3F46' },
    // Vivid cool — violet secondary, deep navy-black text.
    { secondary: '#7C3AED', tint: '#EEF2FF', dark: '#0B1020', heading: '#0B1120', body: '#1E293B' },
  ],
  dark: [
    // Cool steel — darker/cooler tint than minimal, near-black panel, sky accent.
    { secondary: '#0284C7', tint: '#E2E8F0', dark: '#020617', heading: '#0B1120', body: '#334155' },
    // Warm charcoal — stone tint, near-black panel, amber accent.
    { secondary: '#B45309', tint: '#E7E5E4', dark: '#0C0A09', heading: '#1C1917', body: '#44403C' },
  ],
  corporate: [
    // Professional blue — classic navy/blue B2B system.
    { secondary: '#2563EB', tint: '#EFF6FF', dark: '#0B1D3A', heading: '#102A43', body: '#334E68' },
    // Muted slate — quieter gray-blue B2B system.
    { secondary: '#486581', tint: '#F4F4F5', dark: '#18202B', heading: '#1F2933', body: '#3E4C59' },
  ],
  playful: [
    // Pink/teal pop — fuchsia-plum dark, teal secondary.
    { secondary: '#0D9488', tint: '#FFF1F2', dark: '#3F0D3D', heading: '#3F0D3D', body: '#44337A' },
    // Citrus pop — amber dark, green secondary.
    { secondary: '#15803D', tint: '#FEFCE8', dark: '#422006', heading: '#422006', body: '#713F12' },
  ],
  elegant: [
    // Warm ivory + burgundy — quiet luxury.
    { secondary: '#9F1239', tint: '#FAF5F2', dark: '#1C1917', heading: '#292524', body: '#57534E' },
    // Cool violet + indigo — quiet luxury, cooler.
    { secondary: '#7C3AED', tint: '#F5F3FF', dark: '#1E1B4B', heading: '#1E1B4B', body: '#3730A3' },
  ],
};

const FALLBACK_STYLE = 'minimal';

// Deterministic string hash (FNV-1a), NOT randomness — same (style, niche) always
// hashes to the same bucket index, so re-running the pipeline (idempotent/resumable,
// see buildVariants in recipes/matrix.ts) always assigns the same palette to the
// same target. No Date.now/Math.random anywhere in this module.
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Select the shared design-system palette for a (style, niche) target.
 *  `primary` is always the brief's own `accentColorHex` — the one AI-chosen
 *  accent per brief stays the override hook (per T3.1); everything else comes
 *  from the curated, style-keyed library above so different styles are
 *  visibly different, not just re-tinted. Pure function of style+niche (no
 *  RNG) — same target, same palette, every run. Unknown/missing styles fall
 *  back to the `minimal` bucket rather than throwing. */
export function selectPalette(target: { style?: string; niche?: string }, accentHex: string): Palette {
  const variants = STYLE_PALETTES[target.style ?? ''] ?? STYLE_PALETTES[FALLBACK_STYLE];
  const index = hashString(`${target.style ?? ''}|${target.niche ?? ''}`) % variants.length;
  return { primary: accentHex, ...variants[index] };
}

/** WCAG 2.1 relative-luminance contrast ratio between two hex colors (1–21).
 *  Used to hand-verify the curated palettes above (tests/compose-palettes.test.ts
 *  enforces >= 4.5:1, the AA normal-text minimum, for every heading/body pair
 *  against both white and its own tint). */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string): number => {
    const n = parseInt(hex.replace('#', ''), 16);
    const channel = (c: number): number => {
      const cs = c / 255;
      return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const [lighter, darker] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
