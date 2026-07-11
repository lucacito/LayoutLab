// pipeline/recipes/icons.ts — the VERIFIED icon catalog (rich-generator spec
// §5.4). Kills the star/check/gear monoculture: instead of "choose glyphs ONLY
// from the grounding recipes" (~15 glyphs), directives() injects a ~20-glyph,
// niche-relevant pick-list from this catalog.
//
// Ground truth: every entry is CI-tested (tests/icons.test.ts) to exist in the
// cmap of the actual font files the theme ships (extracted to
// divi-icon-codepoints.json by scripts/extract-divi-icons.ts) — a wrong
// unicode fails the build, never a render. Names/topics are verified visually
// by the render fixture (scripts/icon-fixture.ts).
//
// Scope (documented in the Phase 2 plan): Font Awesome only for now —
// FA name<->code semantics are reliable; ETModules glyph MEANINGS are not
// documented anywhere trustworthy, so they are curated later FROM the fixture
// render (which labels every ETModules codepoint by hex), never tagged blind.
// FA brands-400 is excluded: Divi's icon JSON ({type,weight,unicode}) cannot
// distinguish brands-400 from regular-400.
export interface IconEntry {
  name: string;
  /** Bare lowercase hex codepoint, e.g. 'f00c' (formatIconForPrompt adds &#x…;). */
  unicode: string;
  type: 'fa';
  weight: '400' | '900';
  topics: readonly string[];
}

const T = {
  general: 'general', tech: 'tech', creative: 'creative', media: 'media',
  communication: 'communication', people: 'people', growth: 'growth',
  finance: 'finance', commerce: 'commerce', trust: 'trust', food: 'food',
  home: 'home', health: 'health', fitness: 'fitness', education: 'education',
  community: 'community', nature: 'nature', travel: 'travel', events: 'events',
} as const;

const S = (name: string, unicode: string, ...topics: string[]): IconEntry =>
  ({ name, unicode, type: 'fa', weight: '900', topics });
const R = (name: string, unicode: string, ...topics: string[]): IconEntry =>
  ({ name, unicode, type: 'fa', weight: '400', topics });

export const ICON_CATALOG: readonly IconEntry[] = [
  // ── general / UI ─────────────────────────────────────────────
  S('check', 'f00c', T.general, T.trust),
  S('check-circle', 'f058', T.general, T.trust),
  S('star', 'f005', T.general, T.trust),
  S('heart', 'f004', T.general, T.community, T.health, T.fitness),
  S('bolt', 'f0e7', T.general, T.tech, T.growth, T.fitness),
  S('lightbulb', 'f0eb', T.general, T.creative, T.education),
  S('rocket', 'f135', T.general, T.tech, T.growth, T.fitness),
  S('flag', 'f024', T.events),
  S('eye', 'f06e', T.general, T.media, T.creative, T.fitness),
  S('search', 'f002', T.tech),
  S('cog', 'f013', T.tech),
  S('cogs', 'f085', T.tech),
  S('wrench', 'f0ad', T.home, T.tech),
  S('thumbs-up', 'f164', T.trust, T.community, T.fitness),
  S('trophy', 'f091', T.general, T.growth, T.fitness, T.education),
  S('dumbbell', 'f44b', T.fitness),
  S('bullseye', 'f140', T.growth, T.education),
  S('compass', 'f14e', T.education, T.travel),
  S('globe', 'f0ac', T.community, T.travel, T.tech),
  S('link', 'f0c1', T.tech, T.communication),
  S('cloud', 'f0c2', T.tech),
  S('download', 'f019', T.tech),
  S('upload', 'f093', T.tech),
  S('sync', 'f021', T.tech, T.growth),
  S('clock', 'f017', T.events),
  S('calendar-alt', 'f073', T.events),
  S('gem', 'f3a5', T.trust, T.creative),
  S('gift', 'f06b', T.commerce, T.events, T.community),
  S('certificate', 'f0a3', T.trust, T.education),
  S('filter', 'f0b0', T.tech),
  S('hashtag', 'f292', T.media, T.communication),
  S('share-alt', 'f1e0', T.media, T.communication),
  S('magic', 'f0d0', T.creative),
  S('paper-plane', 'f1d8', T.communication),
  // ── communication / people ──────────────────────────────────
  S('envelope', 'f0e0', T.communication),
  S('phone', 'f095', T.communication),
  S('comment', 'f075', T.communication),
  S('comments', 'f086', T.communication, T.community, T.education),
  S('bullhorn', 'f0a1', T.communication, T.media, T.growth),
  S('users', 'f0c0', T.people, T.community, T.fitness),
  S('user', 'f007', T.people, T.fitness),
  S('user-plus', 'f234', T.people, T.growth, T.fitness),
  S('user-circle', 'f2bd', T.people, T.education),
  S('handshake', 'f2b5', T.people, T.trust, T.community, T.finance),
  // ── location / travel / home ─────────────────────────────────
  S('map-marker-alt', 'f3c5', T.travel, T.home, T.events),
  S('map', 'f279', T.travel, T.events),
  S('home', 'f015', T.home),
  S('building', 'f1ad', T.home, T.finance),
  S('key', 'f084', T.home, T.trust, T.tech),
  S('bed', 'f236', T.home, T.travel),
  S('car', 'f1b9', T.travel),
  S('plane', 'f072', T.travel, T.events),
  S('anchor', 'f13d', T.travel),
  S('ship', 'f21a', T.travel),
  // ── commerce / finance ───────────────────────────────────────
  S('dollar-sign', 'f155', T.finance, T.commerce),
  S('credit-card', 'f09d', T.finance, T.commerce),
  S('money-bill', 'f0d6', T.finance, T.commerce),
  S('chart-line', 'f201', T.finance, T.growth, T.tech),
  S('chart-bar', 'f080', T.finance, T.tech),
  S('chart-pie', 'f200', T.finance, T.tech),
  S('chart-area', 'f1fe', T.finance, T.tech),
  S('shopping-cart', 'f07a', T.commerce),
  S('shopping-bag', 'f290', T.commerce),
  S('shopping-basket', 'f291', T.commerce),
  S('tag', 'f02b', T.commerce),
  S('tags', 'f02c', T.commerce),
  S('truck', 'f0d1', T.commerce, T.travel),
  S('briefcase', 'f0b1', T.finance, T.people),
  S('university', 'f19c', T.finance, T.education, T.trust),
  S('balance-scale', 'f24e', T.trust, T.finance),
  S('gavel', 'f0e3', T.trust),
  // ── security / trust ─────────────────────────────────────────
  S('lock', 'f023', T.trust, T.tech),
  S('unlock', 'f09c', T.trust, T.tech),
  S('shield-alt', 'f3ed', T.trust, T.tech),
  // ── food / hospitality ───────────────────────────────────────
  S('utensils', 'f2e7', T.food),
  S('coffee', 'f0f4', T.food),
  S('beer', 'f0fc', T.food, T.events),
  S('glass-martini', 'f000', T.food, T.events),
  S('birthday-cake', 'f1fd', T.food, T.events),
  S('fire', 'f06d', T.general, T.food, T.fitness),
  // ── nature / community ───────────────────────────────────────
  S('leaf', 'f06c', T.nature, T.community, T.food),
  S('seedling', 'f4d8', T.nature, T.growth, T.community),
  S('tree', 'f1bb', T.nature),
  S('sun', 'f185', T.nature),
  S('moon', 'f186', T.nature),
  S('tint', 'f043', T.nature),
  S('umbrella', 'f0e9', T.nature, T.trust),
  S('snowflake', 'f2dc', T.nature),
  // ── health / fitness ─────────────────────────────────────────
  S('heartbeat', 'f21e', T.fitness, T.health),
  S('stopwatch', 'f2f2', T.fitness, T.events),
  S('futbol', 'f1e3', T.fitness, T.community),
  S('medkit', 'f0fa', T.health),
  S('stethoscope', 'f0f1', T.health),
  // ── education / creative / media ─────────────────────────────
  S('book', 'f02d', T.education),
  S('graduation-cap', 'f19d', T.education, T.growth),
  S('edit', 'f044', T.creative, T.communication),
  S('pencil-alt', 'f303', T.creative),
  S('paint-brush', 'f1fc', T.creative),
  S('music', 'f001', T.media, T.events, T.creative),
  S('film', 'f008', T.media, T.creative),
  S('camera', 'f030', T.media, T.creative),
  S('image', 'f03e', T.media, T.creative),
  S('microphone', 'f130', T.media, T.events),
  S('play', 'f04b', T.media),
  // ── tech ─────────────────────────────────────────────────────
  S('laptop', 'f109', T.tech),
  S('mobile', 'f10b', T.tech),
  S('terminal', 'f120', T.tech),
  S('code', 'f121', T.tech, T.creative),
  S('database', 'f1c0', T.tech),
  S('server', 'f233', T.tech),
  S('plug', 'f1e6', T.tech),
  // ── outline (regular-400) accents — for lighter icon styles ──
  R('heart-outline', 'f004', T.community),
  R('star-outline', 'f005', T.general, T.trust),
  R('check-circle-outline', 'f058', T.general, T.trust),
  R('clock-outline', 'f017', T.events),
  R('comment-outline', 'f075', T.communication),
  R('lightbulb-outline', 'f0eb', T.creative, T.education),
  R('envelope-outline', 'f0e0', T.communication),
  R('gem-outline', 'f3a5', T.trust, T.creative),
];

/** Which topics matter for each catalog niche (lib/catalog/filters.ts
 *  AXIS_VALUES.niche). 'general' is ALWAYS unioned in by iconPickList. */
export const NICHE_TOPICS: Record<string, readonly string[]> = {
  saas: [T.tech, T.growth, T.communication, T.trust, T.finance],
  agency: [T.creative, T.media, T.growth, T.communication, T.people],
  restaurant: [T.food, T.events, T.people],
  real_estate: [T.home, T.trust, T.finance, T.people],
  fitness: [T.fitness, T.health, T.growth, T.people],
  coaching: [T.education, T.growth, T.people, T.communication],
  ecommerce: [T.commerce, T.finance, T.trust, T.growth],
  nonprofit: [T.community, T.nature, T.people, T.trust],
  portfolio: [T.creative, T.media, T.tech, T.people],
  events: [T.events, T.food, T.media, T.travel, T.people],
};

/** Escape hatch, same pattern as DESIGN_LANGUAGES: default ON; ICON_CATALOG=0
 *  reverts the prompts to the pre-catalog icon guidance for eval A/B. */
export function iconCatalogEnabled(): boolean {
  return process.env.ICON_CATALOG !== '0';
}

/** Deterministic, topic-relevant slice of the catalog for a niche. Catalog
 *  order IS the stable order (no hashing needed — the catalog is curated with
 *  general/UI glyphs first, so the head of the filtered list is always a sane
 *  mix). Unknown niches fall back to general-only. */
export function iconPickList(niche: string | undefined, max = 20): IconEntry[] {
  const topics = new Set(['general', ...(NICHE_TOPICS[niche ?? ''] ?? [])]);
  return ICON_CATALOG.filter((e) => e.topics.some((t) => topics.has(t))).slice(0, max);
}

/** The exact shape the model must copy into divi/blurb icon attributes. */
export function formatIconForPrompt(e: IconEntry): string {
  return `${e.name} (type:"${e.type}", weight:"${e.weight}", unicode:"&#x${e.unicode};")`;
}
