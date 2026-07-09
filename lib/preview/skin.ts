// Deterministic, on-brand preview "skin" for layout/pack thumbnails. Until real
// screenshots (Phase 3b) exist, we render a Style-A skeleton tile that varies by
// the layout's TYPE (the structural skeleton) and COLOR axis (the tint), with a
// dark-style override. Pure + framework-free so it's unit-testable.

export type PreviewArchetype =
  | 'hero'
  | 'columns'
  | 'features'
  | 'quotes'
  | 'stack'
  | 'footer'
  | 'header'
  | 'form'
  | 'grid'
  | 'page'
  | 'pack';

const TYPE_TO_ARCHETYPE: Record<string, PreviewArchetype> = {
  hero: 'hero',
  cta: 'hero',
  pricing: 'columns',
  features: 'features',
  testimonials: 'quotes',
  faq: 'stack',
  footer: 'footer',
  header: 'header',
  contact: 'form',
  gallery: 'grid',
  blog: 'grid',
  shop: 'grid',
  full_landing: 'page',
  pack: 'pack',
};

/** Map a layout type (or 'pack') to its skeleton archetype. Unknown → 'hero'. */
export function skeletonForType(type: string | null | undefined): PreviewArchetype {
  if (!type) return 'hero';
  return TYPE_TO_ARCHETYPE[type] ?? 'hero';
}

// Two-stop gradients per color axis value (light tints are derived from these).
const COLOR_STOPS: Record<string, [string, string]> = {
  blue: ['#006BFF', '#4D9DFF'],
  green: ['#0E9F6E', '#34D399'],
  red: ['#E02424', '#F87171'],
  purple: ['#7C3AED', '#A78BFA'],
  orange: ['#F97316', '#FDBA74'],
  monochrome: ['#64748B', '#94A3B8'],
  pastel: ['#A78BFA', '#FBCFE8'],
};
const DEFAULT_STOPS = COLOR_STOPS.blue;

export interface PreviewSkin {
  /** CSS background for the tile. */
  bg: string;
  /** Fill for skeleton blocks. */
  block: string;
  /** Background for the faux browser bar. */
  bar: string;
  /** True for the dark-style treatment (affects label contrast). */
  onDark: boolean;
}

/**
 * Resolve the tile skin from the layout's color axis + style. A 'dark' style
 * overrides to the navy dark treatment regardless of color; otherwise the first
 * color value tints a soft light gradient (fallback: blue).
 */
export function skinForLayout(input: { color?: string | null; style?: string | null }): PreviewSkin {
  if (input.style === 'dark') {
    return {
      bg: 'linear-gradient(135deg, #0B3558, #1E293B)',
      block: 'rgba(255,255,255,0.16)',
      bar: 'rgba(255,255,255,0.10)',
      onDark: true,
    };
  }
  const [c1, c2] = (input.color && COLOR_STOPS[input.color]) || DEFAULT_STOPS;
  return {
    bg: `linear-gradient(135deg, ${c1}22, ${c2}33)`,
    block: 'rgba(255,255,255,0.72)',
    bar: 'rgba(255,255,255,0.55)',
    onDark: false,
  };
}
