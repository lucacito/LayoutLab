export interface Target {
  type: string;
  niche: string;
  style: string;
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

export function planTargets(matrix: Target[], covered: Set<string>, count?: number): Target[] {
  const remaining = matrix.filter((t) => !covered.has(targetKey(t)));
  return count != null ? remaining.slice(0, count) : remaining;
}
