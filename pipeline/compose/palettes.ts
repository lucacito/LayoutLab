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

/** A curated variant PLUS a stable `id`. The id is the append-stability anchor for
 *  `pickByRendezvous` below — it is never derived from array position, so inserting
 *  or reordering entries can't silently remap keys that already resolved elsewhere.
 *  Rename an id only if you intend to deliberately reshuffle that variant's keys. */
interface StylePaletteVariant extends StylePaletteBase {
  id: string;
}

const STYLE_PALETTES: Record<string, StylePaletteVariant[]> = {
  minimal: [
    // Cool slate — airy, neutral (closest to the original single default).
    { id: 'minimal-cool-slate', secondary: '#64748B', tint: '#F8FAFC', dark: '#0F172A', heading: '#0F172A', body: '#334155' },
    // Warm greige — airy but paper-like/warmer.
    { id: 'minimal-warm-greige', secondary: '#78716C', tint: '#FAF7F2', dark: '#292524', heading: '#292524', body: '#57534E' },
  ],
  bold: [
    // Vivid warm — punchy orange secondary, near-black text.
    { id: 'bold-vivid-warm', secondary: '#EA580C', tint: '#FFF7ED', dark: '#18181B', heading: '#18181B', body: '#3F3F46' },
    // Vivid cool — violet secondary, deep navy-black text.
    { id: 'bold-vivid-cool', secondary: '#7C3AED', tint: '#EEF2FF', dark: '#0B1020', heading: '#0B1120', body: '#1E293B' },
  ],
  dark: [
    // Cool steel — darker/cooler tint than minimal, near-black panel, sky accent.
    { id: 'dark-cool-steel', secondary: '#0284C7', tint: '#E2E8F0', dark: '#020617', heading: '#0B1120', body: '#334155' },
    // Warm charcoal — stone tint, near-black panel, amber accent.
    { id: 'dark-warm-charcoal', secondary: '#B45309', tint: '#E7E5E4', dark: '#0C0A09', heading: '#1C1917', body: '#44403C' },
  ],
  corporate: [
    // Professional blue — classic navy/blue B2B system.
    { id: 'corporate-professional-blue', secondary: '#2563EB', tint: '#EFF6FF', dark: '#0B1D3A', heading: '#102A43', body: '#334E68' },
    // Muted slate — quieter gray-blue B2B system.
    { id: 'corporate-muted-slate', secondary: '#486581', tint: '#F4F4F5', dark: '#18202B', heading: '#1F2933', body: '#3E4C59' },
  ],
  playful: [
    // Pink/teal pop — fuchsia-plum dark, teal secondary.
    { id: 'playful-pink-teal', secondary: '#0D9488', tint: '#FFF1F2', dark: '#3F0D3D', heading: '#3F0D3D', body: '#44337A' },
    // Citrus pop — amber dark, green secondary.
    { id: 'playful-citrus', secondary: '#15803D', tint: '#FEFCE8', dark: '#422006', heading: '#422006', body: '#713F12' },
  ],
  elegant: [
    // Warm ivory + burgundy — quiet luxury.
    { id: 'elegant-warm-ivory-burgundy', secondary: '#9F1239', tint: '#FAF5F2', dark: '#1C1917', heading: '#292524', body: '#57534E' },
    // Cool violet + indigo — quiet luxury, cooler.
    { id: 'elegant-cool-violet-indigo', secondary: '#7C3AED', tint: '#F5F3FF', dark: '#1E1B4B', heading: '#1E1B4B', body: '#3730A3' },
  ],
};

const FALLBACK_STYLE = 'minimal';

// Deterministic string hash (FNV-1a), NOT randomness — same input string always
// hashes to the same number, so re-running the pipeline (idempotent/resumable,
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

function paletteKey(target: { style?: string; niche?: string }): string {
  return `${target.style ?? ''}|${target.niche ?? ''}`;
}

function variantsFor(style: string | undefined): StylePaletteVariant[] {
  return STYLE_PALETTES[style ?? ''] ?? STYLE_PALETTES[FALLBACK_STYLE];
}

/** Select the shared design-system palette for a (style, niche) target.
 *  `primary` is always the brief's own `accentColorHex` — the one AI-chosen
 *  accent per brief stays the override hook (per T3.1); everything else comes
 *  from the curated, style-keyed library above so different styles are
 *  visibly different, not just re-tinted. Pure function of style+niche (no
 *  RNG) — same target, same palette, every run. Selection uses `pickByRendezvous`
 *  (not `hash % length`) so appending a new variant to a style bucket never
 *  remaps an already-assigned (style, niche) pair to a different EXISTING
 *  variant. Unknown/missing styles fall back to the `minimal` bucket rather
 *  than throwing. */
export function selectPalette(target: { style?: string; niche?: string }, accentHex: string): Palette {
  const variants = variantsFor(target.style);
  const { id: _id, ...paletteFields } = pickByRendezvous(paletteKey(target), variants);
  return { primary: accentHex, ...paletteFields };
}

/** Returns the stable `id` of the variant `selectPalette` would choose for this
 *  target, without needing the accent hex. Exists for tests: pin concrete
 *  (style, niche) -> id selections as a snapshot so an edit that reshuffles the
 *  scheme (e.g. reverting to modulo indexing) breaks loudly instead of silently
 *  changing which palette a given target gets. */
export function selectPaletteVariantId(target: { style?: string; niche?: string }): string {
  return pickByRendezvous(paletteKey(target), variantsFor(target.style)).id;
}

const HEX_COLOR_RE = /^#?[0-9A-Fa-f]{6}$/;

/** WCAG 2.1 relative-luminance contrast ratio between two hex colors (1–21).
 *  Used to hand-verify the curated palettes above (tests/compose-palettes.test.ts
 *  enforces >= 4.5:1, the AA normal-text minimum, for every heading/body pair
 *  against both white and its own tint, and >= 4.5:1 for tint-vs-dark). Throws on
 *  a malformed hex string (this is exported, called with palette data that could
 *  come from a future theme-pinned brief) rather than silently computing garbage
 *  from `parseInt`. */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string): number => {
    if (!HEX_COLOR_RE.test(hex)) {
      throw new Error(`contrastRatio: expected a 6-digit hex color, got ${JSON.stringify(hex)}`);
    }
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
