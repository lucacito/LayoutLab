// Shared navigation data. PRIMARY_NAV drives the plugins-first header (desktop
// + mobile); the axis metadata (AXIS_META) feeds the footer and catalog
// taxonomy pages. Pure + client-safe (no DB). Icons are Material Icons
// (outlined) ligature names.

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

// A primary nav item. Items with a `mega` key open a mega-menu panel on
// hover/focus while their label still navigates to `href`.
export type MegaKey = 'plugins' | 'layouts';
export type NavLinkMenu = { key: string; label: string; href: string; mega?: MegaKey };

// Primary navigation (plugins-first). "Plugins" and "Free layouts" open
// mega-menus; "Free layouts" itself lands on the full /browse catalog.
export const PRIMARY_NAV: NavLinkMenu[] = [
  { key: 'plugins', label: 'Plugins', href: '/plugins', mega: 'plugins' },
  { key: 'layouts', label: 'Free layouts', href: '/browse', mega: 'layouts' },
  { key: 'guides', label: 'Guides', href: '/guides' },
];

// ── Plugins mega-menu ───────────────────────────────────────────────────────
export type PluginMenuItem = {
  name: string;
  desc: string;
  href: string;
  icon: string;
  chip: string;
  tone: 'green' | 'amber';
};

export const PLUGIN_MENU: PluginMenuItem[] = [
  {
    name: 'Elementor → Divi 5',
    desc: 'Migrate Elementor pages and kits into validated Divi 5.',
    href: '/plugins/elementor-to-divi-5',
    icon: 'sync_alt',
    chip: 'Free · Pro $49/yr',
    tone: 'green',
  },
  {
    name: 'Divi → Elementor',
    desc: 'Batch-convert Divi sites the other way.',
    href: '/plugins/divi-to-elementor',
    icon: 'u_turn_left',
    chip: 'Pending wordpress.org review',
    tone: 'amber',
  },
  {
    name: 'AI Editor for Divi 5',
    desc: 'Edit Divi 5 in plain English — every change validated.',
    href: '/plugins/divi-5-ai-editor',
    icon: 'smart_toy',
    chip: 'Free · Pro $39/yr',
    tone: 'green',
  },
];

// ── Free-layouts mega-menu ──────────────────────────────────────────────────
export type MegaLink = { href: string; label: string; icon: string; blurb: string };
export type MegaColumn = { title: string; links: MegaLink[] };

const typeLink = (v: string): MegaLink => ({
  href: `/type/${v}`,
  label: TYPE_LABELS[v] ?? v,
  icon: AXIS_META.type[v]?.icon ?? 'grid_view',
  blurb: AXIS_META.type[v]?.blurb ?? '',
});
const nicheLink = (v: string): MegaLink => ({
  href: `/niche/${v}`,
  label: NICHE_LABELS[v] ?? v,
  icon: AXIS_META.niche[v]?.icon ?? 'grid_view',
  blurb: AXIS_META.niche[v]?.blurb ?? '',
});
const styleLink = (v: string): MegaLink => ({
  href: `/style/${v}`,
  label: v.charAt(0).toUpperCase() + v.slice(1),
  icon: AXIS_META.style[v]?.icon ?? 'grid_view',
  blurb: AXIS_META.style[v]?.blurb ?? '',
});

export const LAYOUT_MENU_COLUMNS: MegaColumn[] = [
  {
    title: 'By type',
    links: ['hero', 'pricing', 'features', 'cta', 'testimonials', 'faq', 'cards', 'full_landing'].map(typeLink),
  },
  {
    title: 'By industry',
    links: ['saas', 'agency', 'restaurant', 'real_estate', 'fitness', 'ecommerce'].map(nicheLink),
  },
  {
    title: 'By style',
    links: ['minimal', 'bold', 'dark', 'elegant'].map(styleLink),
  },
];

export const LAYOUT_MENU_CTA: MegaLink = {
  href: '/browse',
  label: 'Browse all layouts',
  icon: 'grid_view',
  blurb: 'The full validated catalog — filter by type, industry, style and colour.',
};
