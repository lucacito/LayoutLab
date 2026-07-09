import { axisLabel } from './taxonomy-copy';

// Curated internal-link hubs for link sculpting. These are the taxonomy pages we
// deliberately push equity toward from the money page (/browse) and the sitewide
// band. Curated subsets of AXIS_VALUES (lib/catalog/filters.ts) — kept focused so
// anchor-text density stays meaningful. Values MUST exist in AXIS_VALUES; the
// test asserts this so a renamed/removed value fails loudly instead of 404-ing.
const TYPE_VALUES = ['hero', 'pricing', 'cta', 'testimonials', 'features', 'faq', 'footer', 'contact', 'gallery', 'full_landing'];
const NICHE_VALUES = ['saas', 'agency', 'ecommerce', 'restaurant', 'real_estate', 'fitness', 'coaching'];

export interface HubLink {
  label: string;
  href: string;
}
export interface HubLinkGroup {
  heading: string;
  axis: 'type' | 'niche' | 'collection';
  links: HubLink[];
}

function toLinks(axis: 'type' | 'niche', values: string[]): HubLink[] {
  return values.map((v) => ({ label: axisLabel(v), href: `/${axis}/${v}` }));
}

// Broad-keyword collection pages + editorial guides — the third equity lane.
// Slugs must exist in lib/seo/keyword-pages.ts (or be real routes); the
// internal-links test asserts this.
const COLLECTION_LINKS: HubLink[] = [
  { label: 'Divi Layouts', href: '/divi-layouts' },
  { label: 'Divi Templates', href: '/divi-templates' },
  { label: 'Free Divi Layouts', href: '/free-divi-layouts' },
  { label: 'Landing Pages', href: '/divi-landing-pages' },
  { label: 'Hero Sections', href: '/divi-hero-sections' },
  { label: 'Pricing Tables', href: '/divi-pricing-tables' },
  { label: 'Guides', href: '/guides' },
];

export function hubLinkGroups(): HubLinkGroup[] {
  return [
    { heading: 'Layouts/Sections', axis: 'type', links: toLinks('type', TYPE_VALUES) },
    { heading: 'Industries', axis: 'niche', links: toLinks('niche', NICHE_VALUES) },
    { heading: 'Collections & Guides', axis: 'collection', links: COLLECTION_LINKS },
  ];
}
