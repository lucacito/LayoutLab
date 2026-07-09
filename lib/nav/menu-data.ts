// Shared navigation data for the desktop megamenu + the mobile menu. Pure +
// client-safe (no DB). Icons are Material Icons (outlined) ligature names.

export type NavAxis = 'type' | 'niche' | 'style';

export const AXIS_META: Record<NavAxis, Record<string, { icon: string; blurb: string }>> = {
  type: {
    hero: { icon: 'web', blurb: 'Above-the-fold openers' },
    pricing: { icon: 'sell', blurb: 'Plans & price tables' },
    testimonials: { icon: 'format_quote', blurb: 'Social proof & reviews' },
    cta: { icon: 'ads_click', blurb: 'Conversion call-to-actions' },
    features: { icon: 'grid_view', blurb: 'Benefit & feature grids' },
    cards: { icon: 'dashboard', blurb: 'Icon & numbered card grids' },
    faq: { icon: 'quiz', blurb: 'Question & answer blocks' },
    footer: { icon: 'border_bottom', blurb: 'Site footers' },
    contact: { icon: 'mail', blurb: 'Contact & lead forms' },
    gallery: { icon: 'photo_library', blurb: 'Image galleries' },
    blog: { icon: 'article', blurb: 'Article & blog layouts' },
    shop: { icon: 'storefront', blurb: 'WooCommerce product grids' },
    full_landing: { icon: 'web_asset', blurb: 'Complete landing pages' },
  },
  niche: {
    saas: { icon: 'cloud', blurb: 'Software & apps' },
    agency: { icon: 'campaign', blurb: 'Studios & agencies' },
    restaurant: { icon: 'restaurant', blurb: 'Food & dining' },
    real_estate: { icon: 'home_work', blurb: 'Property & realty' },
    fitness: { icon: 'fitness_center', blurb: 'Gyms & wellness' },
    coaching: { icon: 'school', blurb: 'Coaches & courses' },
    ecommerce: { icon: 'shopping_cart', blurb: 'Online stores' },
    nonprofit: { icon: 'volunteer_activism', blurb: 'Causes & charities' },
    portfolio: { icon: 'palette', blurb: 'Personal & creative' },
    events: { icon: 'event', blurb: 'Events & conferences' },
  },
  style: {
    minimal: { icon: 'air', blurb: 'Clean & spacious' },
    bold: { icon: 'bolt', blurb: 'High-impact & loud' },
    dark: { icon: 'dark_mode', blurb: 'Dark-themed' },
    corporate: { icon: 'apartment', blurb: 'Professional & formal' },
    playful: { icon: 'celebration', blurb: 'Fun & friendly' },
    elegant: { icon: 'diamond', blurb: 'Refined & premium' },
  },
};

// Human-friendly section titles for each layout type (used on homepage category rows).
export const TYPE_LABELS: Record<string, string> = {
  hero: 'Hero sections',
  pricing: 'Pricing tables',
  testimonials: 'Testimonials',
  cta: 'Call-to-action',
  features: 'Feature grids',
  cards: 'Cards',
  faq: 'FAQ sections',
  footer: 'Footers',
  contact: 'Contact forms',
  gallery: 'Galleries',
  blog: 'Blog layouts',
  shop: 'Shop / product grids',
  full_landing: 'Full landing pages',
};

// Human-friendly section titles for each industry/niche (homepage category rows).
export const NICHE_LABELS: Record<string, string> = {
  saas: 'SaaS',
  agency: 'Agencies',
  restaurant: 'Restaurants',
  real_estate: 'Real estate',
  fitness: 'Fitness',
  coaching: 'Coaching',
  ecommerce: 'E-commerce',
  nonprofit: 'Nonprofits',
  portfolio: 'Portfolios',
  events: 'Events',
};

// A megamenu entry is either an axis dropdown (opens a panel of taxonomy values)
// or a plain link (e.g. Themes/Packs → the packs catalog).
export type NavAxisMenu = { key: string; label: string; axis: NavAxis; prefix: string; blurb: string };
export type NavLinkMenu = { key: string; label: string; href: string };
export type NavMenu = NavAxisMenu | NavLinkMenu;

export function isAxisMenu(m: NavMenu): m is NavAxisMenu {
  return 'axis' in m;
}

export const NAV_MENUS: NavMenu[] = [
  { key: 'type', label: 'Layouts/Sections', axis: 'type', prefix: '/type', blurb: 'Browse by section type' },
  { key: 'packs', label: 'Themes/Packs', href: '/packs' },
  { key: 'niche', label: 'Industries', axis: 'niche', prefix: '/niche', blurb: 'Browse by industry' },
];
