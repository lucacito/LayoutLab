import { AXIS_VALUES } from '@/lib/catalog/filters';

export interface Target {
  type: string;
  niche: string;
  style: string;
  /** Driven color palette (color-axis value) — variation axis. */
  color?: string;
  /** Composition / placement instruction for the prompt — variation axis. */
  layout?: string;
  /** Structured variant attributes, persisted for sibling cross-linking. */
  variant?: { group: string; columns: number; icons: 'none' | 'top' | 'left'; iconStyle: 'circle' | 'plain' | 'number' };
}

const ICON_PHRASE: Record<'none' | 'top' | 'left', string> = {
  none: 'no icons',
  top: 'an icon centered on top of each card',
  left: 'an icon to the left of each card title',
};

const ICON_STYLE_PHRASE: Record<'circle' | 'plain' | 'number', string> = {
  circle: 'in a filled circular badge',
  plain: 'as a bare icon',
  number: 'shown as a numbered step badge',
};

// Build a switchable SET of card-section variants: every column count × icon
// placement × icon style for one niche/style, all sharing a `group` so the UI can
// cross-link them (Columns 2·3·4, Icons top·left, Style circle·plain·number).
export function buildVariantSet(
  base: { type: string; niche: string; style: string; color?: string },
  columns: number[],
  icons: ('none' | 'top' | 'left')[],
  iconStyles: ('circle' | 'plain' | 'number')[],
): Target[] {
  const group = `${base.type}-${base.niche}-${base.style}`;
  const out: Target[] = [];
  for (const c of columns) {
    for (const ic of icons) {
      for (const st of iconStyles) {
        out.push({
          type: base.type,
          niche: base.niche,
          style: base.style,
          color: base.color,
          layout: `${c} equal columns of cards, with ${ICON_PHRASE[ic]}, ${ICON_STYLE_PHRASE[st]}`,
          variant: { group, columns: c, icons: ic, iconStyle: st },
        });
      }
    }
  }
  return out;
}

// Curated starter coverage. Axis values must exist in AXIS_VALUES
// (lib/catalog/filters.ts). Expand over time; planTargets skips covered combos.
export const MATRIX: Target[] = [
  { type: 'hero', niche: 'saas', style: 'minimal' },
  { type: 'hero', niche: 'agency', style: 'bold' },
  { type: 'pricing', niche: 'saas', style: 'dark' },
  { type: 'features', niche: 'saas', style: 'minimal' },
  { type: 'testimonials', niche: 'coaching', style: 'elegant' },
  { type: 'cta', niche: 'fitness', style: 'bold' },
  { type: 'faq', niche: 'nonprofit', style: 'minimal' },
  { type: 'footer', niche: 'agency', style: 'dark' },
  { type: 'contact', niche: 'real_estate', style: 'corporate' },
  { type: 'gallery', niche: 'portfolio', style: 'playful' },
  // Fresh section targets (uncovered combos) for live generation.
  { type: 'hero', niche: 'ecommerce', style: 'bold' },
  { type: 'cta', niche: 'saas', style: 'minimal' },
  { type: 'features', niche: 'agency', style: 'bold' },
  { type: 'testimonials', niche: 'saas', style: 'minimal' },
  { type: 'pricing', niche: 'fitness', style: 'bold' },
  { type: 'features', niche: 'coaching', style: 'elegant' },
  // Broader fill across the main section types × niches × styles.
  { type: 'hero', niche: 'restaurant', style: 'bold' },
  { type: 'hero', niche: 'coaching', style: 'elegant' },
  { type: 'hero', niche: 'real_estate', style: 'corporate' },
  { type: 'hero', niche: 'fitness', style: 'bold' },
  { type: 'cta', niche: 'agency', style: 'dark' },
  { type: 'cta', niche: 'ecommerce', style: 'bold' },
  { type: 'cta', niche: 'nonprofit', style: 'minimal' },
  { type: 'features', niche: 'ecommerce', style: 'bold' },
  { type: 'features', niche: 'fitness', style: 'bold' },
  { type: 'features', niche: 'real_estate', style: 'corporate' },
  { type: 'pricing', niche: 'saas', style: 'minimal' },
  { type: 'pricing', niche: 'agency', style: 'bold' },
  { type: 'pricing', niche: 'coaching', style: 'elegant' },
  { type: 'testimonials', niche: 'agency', style: 'bold' },
  { type: 'testimonials', niche: 'fitness', style: 'bold' },
  { type: 'faq', niche: 'saas', style: 'minimal' },
  { type: 'faq', niche: 'ecommerce', style: 'corporate' },
  { type: 'contact', niche: 'agency', style: 'dark' },
  { type: 'contact', niche: 'saas', style: 'minimal' },
  { type: 'gallery', niche: 'restaurant', style: 'elegant' },
  { type: 'gallery', niche: 'real_estate', style: 'corporate' },
];

export function targetKey(t: Target): string {
  return `${t.type}|${t.niche}|${t.style}`;
}

// Per-type composition variety (placement / layout instructions for the prompt).
const LAYOUTS_BY_TYPE: Record<string, string[]> = {
  hero: ['image on the right of the headline', 'image on the left of the headline', 'centered headline over a full-bleed background image', 'split 50/50 with a sign-up form', 'centered with a product/app shot below the CTA'],
  cta: ['centered headline and a single button', 'split with a supporting image on one side', 'full-bleed banner with an overlay', 'card-style CTA with a subtle border'],
  features: ['three columns of cards', 'four columns with icons', 'a two-by-two grid', 'alternating image + text rows', 'a left intro with a feature list on the right'],
  pricing: ['three pricing columns with a highlighted middle plan', 'a two-column comparison', 'a single highlighted plan with a feature checklist'],
  testimonials: ['three-column quote cards with avatars', 'one large featured quote with an avatar', 'a logo strip above a featured quote'],
  faq: ['a two-column accordion', 'a centered single-column list', 'categorized question columns'],
  contact: ['form on the left, contact details on the right', 'a centered contact form', 'split with a map-style image'],
  gallery: ['a three-column image grid', 'a masonry-style grid', 'a horizontal image row'],
  footer: ['multi-column links with a newsletter signup', 'a centered minimal footer'],
  cards: ['equal columns of icon cards', 'equal columns of numbered step cards'],
};
const DEFAULT_LAYOUTS = ['a centered composition', 'an asymmetric split two-column composition', 'a stacked full-width composition'];

// Types we deliberately do NOT generate. Headers need a real Divi menu module
// (hamburger on mobile, references a site WP menu) and are built globally in the
// Theme Builder — they don't work as importable, portable sections.
const UNSUPPORTED_TYPES = new Set(['header']);

// Build `count` diverse variants per type, each a distinct (niche, style, color,
// layout) combination. Deterministic (index-seeded with coprime strides) so runs
// are reproducible and spread evenly across the axes — no Date/random.
export function buildVariants(types: string[], count: number): Target[] {
  const { niche: niches, style: styles, color: colors } = AXIS_VALUES;
  const out: Target[] = [];
  let i = 0;
  for (const type of types) {
    if (UNSUPPORTED_TYPES.has(type)) continue;
    const layouts = LAYOUTS_BY_TYPE[type] ?? DEFAULT_LAYOUTS;
    for (let n = 0; n < count; n++, i++) {
      out.push({
        type,
        niche: niches[i % niches.length],
        style: styles[(i * 3 + 1) % styles.length],
        color: colors[(i * 5 + 2) % colors.length],
        layout: layouts[n % layouts.length],
      });
    }
  }
  return out;
}

export function planTargets(matrix: Target[], covered: Set<string>, count?: number): Target[] {
  const remaining = matrix.filter((t) => !covered.has(targetKey(t)));
  return count != null ? remaining.slice(0, count) : remaining;
}
