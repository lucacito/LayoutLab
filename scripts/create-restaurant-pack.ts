// Generate a coherent 6-page RESTAURANT theme (the "same pages pack" as Blackline,
// new industry) and assemble it into one paid pack. Idempotent: re-runs dedupe by
// content hash and upsert the pack by slug.
//
// Needs (like the main pipeline): the local web app up (ingest → localhost:3000),
// the Docker WP+Divi render env up (divi5val_wpcli:8181), the validator, PEXELS +
// BLOB + INGEST_API_TOKEN + POSTGRES_URL + STRIPE_SECRET_KEY in env. Run with:
//   npm run dev            # in another shell (ingest target)
//   set -a && . ./.env.local && set +a && npm run tsx scripts/create-restaurant-pack.ts
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, packLayouts, layouts } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, themePageSlug, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

// ── The brand (pinned — shared verbatim across all 6 pages) ────────────────────
const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Bella Nota',
  tagline: 'Wood-fired Italian, made by hand',
  audience: 'locals and couples who want a warm, memorable night out',
  conversionGoal: 'book a table',
  primaryCta: 'Reserve a Table',
  accentColorHex: '#B4472E',
  voice: 'warm, confident and unfussy — a neighborhood trattoria that quietly takes its craft seriously',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, ' +
  'address, phone, email or booking appears, and NEVER invent alternatives: ' +
  'Name: Bella Nota. Phone: (415) 555-0148. Email: hello@bellanota.com. ' +
  'Address: 214 Bay Street, San Francisco, CA 94133. ' +
  'Hours: Tue–Sun 5:00–10:30pm; closed Mondays. ' +
  'Reservations: book online or call. Accent color: terracotta #B4472E.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

// Every page opens on `hero` and closes on `final_cta` (both required by composeLanding).
const PAGES: ThemePage[] = [
  {
    role: 'home', roleLabel: 'Home',
    flow: [
      S('hero', 'hero', 'Welcome guests to Bella Nota: the wood-fired Italian promise, who it is for, and the ONE action — Reserve a Table — with an inviting visual.', true),
      S('benefits', 'cards', 'Why dine here: 3-4 outcome-led cards (hand-made pasta, live wood fire, natural wine, warm room). Outcomes, not features.', true),
      S('experience', 'features', 'The Bella Nota experience: the room, the fire, the pace of the evening — sell the feeling of the night.'),
      S('gallery', 'gallery', 'A look at signature plates and the dining room.'),
      S('social_proof', 'testimonials', '2-3 guest testimonials (bracketed placeholders, never fabricated as real).', true),
      S('final_cta', 'cta', 'Restate the promise and the one action: Reserve a Table tonight. Minimal distractions.', true),
    ],
  },
  {
    role: 'menu', roleLabel: 'Menu',
    flow: [
      S('hero', 'hero', 'Introduce the menu: seasonal, wood-fired, hand-made — and the primary action to reserve.', true),
      S('philosophy', 'features', 'Menu philosophy: sourcing, the wood fire, made-from-scratch pasta — why the food tastes the way it does.'),
      S('highlights', 'cards', 'Signature dishes by course (antipasti, primi/pasta, secondi, dolci): each a card with the dish name, a mouth-watering one-line description and a bracketed price placeholder.', true),
      S('gallery', 'gallery', 'Close-up photos of standout dishes.'),
      S('faq', 'faq', 'Real menu questions: dietary/allergen options, vegetarian dishes, seasonal changes, corkage.'),
      S('final_cta', 'cta', 'Invite them to book a table to taste it. One action.', true),
    ],
  },
  {
    role: 'about', roleLabel: 'About',
    flow: [
      S('hero', 'hero', 'Our story: how Bella Nota started and what it stands for, with a warm founder-led tone.', true),
      S('values', 'features', 'What we believe: hospitality, craft, sourcing — the three ideas that run the kitchen.'),
      S('people', 'cards', 'The people behind the restaurant: chef/owner and team as cards (name, role, one line) with bracketed placeholders.'),
      S('press', 'testimonials', 'Press quotes and guest love (bracketed placeholders).', true),
      S('final_cta', 'cta', 'Warmly invite the reader to come in: Reserve a Table.', true),
    ],
  },
  {
    role: 'gallery', roleLabel: 'Gallery',
    flow: [
      S('hero', 'hero', 'A look inside Bella Nota — the room, the fire, the plates. Primary action to reserve.', true),
      S('room', 'gallery', 'The dining room and bar: atmosphere shots.'),
      S('plates', 'gallery', 'The food: a second gallery of signature plates and desserts.'),
      S('social_proof', 'testimonials', 'A couple of short guest quotes about the atmosphere (bracketed placeholders).', true),
      S('final_cta', 'cta', 'Invite them to experience it in person: Reserve a Table.', true),
    ],
  },
  {
    role: 'reservations', roleLabel: 'Reservations',
    flow: [
      S('hero', 'hero', 'Book your table at Bella Nota: reassuring, easy, the primary action front and center.', true),
      S('details', 'features', 'What to know before you book: hours, private dining, large parties, what to expect — using the canonical hours/address.'),
      S('faq', 'faq', 'Reservation policy questions: group size, cancellations, walk-ins, parking, deposits.'),
      S('contact', 'contact', 'Reservation contact block with the canonical phone, email, address and hours, plus a booking form.'),
      S('final_cta', 'cta', 'Final nudge to reserve now. One action.', true),
    ],
  },
  {
    role: 'contact', roleLabel: 'Contact',
    flow: [
      S('hero', 'hero', 'Find Bella Nota: a warm one-liner and the primary action.', true),
      S('contact', 'contact', 'Full contact block: canonical address, phone, email, hours and a message form. Mention the neighborhood.'),
      S('faq', 'faq', 'Common questions: parking, accessibility, private events, gift cards.'),
      S('final_cta', 'cta', 'Invite them to book or drop by: Reserve a Table.', true),
    ],
  },
];

const SPEC: ThemeSpec = { niche: 'restaurant', style: 'elegant', color: 'warm', brief: BRIEF, brandFacts: BRAND_FACTS, pages: PAGES };

// ── Pack metadata ──────────────────────────────────────────────────────────────
const PACK_SLUG = 'bella-nota-restaurant-theme';
const PACK_TITLE = 'Bella Nota — Warm Italian Restaurant Theme (6 Pages)';
const PRICE_CENTS = 1200; // $12, same as Blackline
const DESCRIPTION =
  'Everything a restaurant needs to open online — six coherent, appetite-driven Divi 5 ' +
  'pages that already share one warm identity. Home, Menu, About, Gallery, Reservations and ' +
  'Contact, all built on one brand voice, one terracotta palette and one consistent set of ' +
  'hours, address and booking details — so you swap in your own name, photos and menu and go ' +
  'live in an afternoon. This is not six stock templates in a folder: it is a real restaurant ' +
  'website. The Home page sets the table, the Menu page makes people hungry, the Gallery sells ' +
  'the room, and the Reservations and Contact pages turn a browse into a booking — every headline ' +
  'written like a senior copywriter wrote it, every section validated and screenshot-perfect. No ' +
  'lorem ipsum, no broken layouts, no "your content here." One simple commercial license, unlimited ' +
  'client sites. At $12, the easiest reservation you will make all week.';
const PACK_SEO = {
  metaTitle: 'Bella Nota — Warm Italian Restaurant Theme for Divi 5 (6 Coherent Pages) | Divi5Lab',
  metaDescription:
    'A complete 6-page Divi 5 restaurant website theme — Home, Menu, About, Gallery, Reservations ' +
    '& Contact — one warm brand, senior-level copy, real booking details. Launch a premium ' +
    'restaurant site in an afternoon. $12.',
  keywords: [
    'divi 5 restaurant theme', 'restaurant website template', 'divi restaurant pack',
    'italian restaurant website', 'divi 5 multi-page theme', 'trattoria website template',
  ],
};

async function upsertPack(slugs: string[]): Promise<void> {
  const rows = await db
    .select({ id: layouts.id, slug: layouts.slug, previews: layouts.previewImageKeys })
    .from(layouts).where(inArray(layouts.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const found = slugs.filter((s) => bySlug.has(s));
  if (found.length === 0) { console.error('no restaurant pages found in DB — did ingest run?'); process.exitCode = 1; return; }
  if (found.length < slugs.length) console.warn(`only ${found.length}/${slugs.length} pages present; linking what exists`);

  const cover = bySlug.get(slugs[0])?.previews?.[0] ?? bySlug.get(found[0])!.previews?.[0] ?? null;
  const existing = (await db.select().from(packs).where(eq(packs.slug, PACK_SLUG)).limit(1))[0];
  const common = {
    title: PACK_TITLE, description: DESCRIPTION, kind: 'paid' as const,
    priceCents: PRICE_CENTS, coverImageKey: cover, seo: PACK_SEO, status: 'published' as const,
  };
  let packId: string;
  let stripePriceId: string | null;
  if (existing) {
    packId = existing.id;
    const priceChanged = existing.priceCents !== PRICE_CENTS;
    stripePriceId = priceChanged ? null : existing.stripePriceId;
    await db.update(packs).set({ ...common, ...(priceChanged ? { stripePriceId: null } : {}) }).where(eq(packs.id, packId));
  } else {
    packId = randomUUID();
    stripePriceId = null;
    await db.insert(packs).values({ id: packId, slug: PACK_SLUG, ...common });
  }

  await db.delete(packLayouts).where(eq(packLayouts.packId, packId));
  await db.insert(packLayouts).values(found.map((s, i) => ({ packId, layoutId: bySlug.get(s)!.id, position: i })));

  if (!stripePriceId) {
    const product = await stripe.products.create({ name: PACK_TITLE, metadata: { packSlug: PACK_SLUG } });
    const price = await stripe.prices.create({ product: product.id, unit_amount: PRICE_CENTS, currency: 'usd' });
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, packId));
    console.log(`created Stripe price ${price.id}`);
  } else {
    console.log(`pack already has Stripe price ${stripePriceId}`);
  }
  console.log(`\nPack ready: /packs/${PACK_SLUG}  ($${(PRICE_CENTS / 100).toFixed(2)}, ${found.length} pages, cover=${cover ? 'set' : 'none'})`);
}

async function main() {
  // Followups #1: shared factory (pipeline/deps.ts) wires the SAME real gates
  // `npm run pipeline` gets — visionCritic, nearDuplicateHashes (excluding this
  // pack's own pages — see buildThemeDeps's doc on the T4.2 resume trap),
  // onEvent, and the T2.1 render-outcome contract — instead of a hand-rolled
  // deps object that silently lacked all four.
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[theme]', defaultMaxBudgetUsd: 1 });

  // Optional smoke-test knob: THEME_ONLY_ROLES=home,menu limits which pages generate.
  // (Pack assembly still links whatever pages exist in the DB by slug.)
  const onlyRoles = (process.env.THEME_ONLY_ROLES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const spec: ThemeSpec = onlyRoles.length ? { ...SPEC, pages: SPEC.pages.filter((p) => onlyRoles.includes(p.role)) } : SPEC;

  console.log(`[theme] generating ${spec.pages.length} ${spec.niche} pages for "${BRIEF.businessName}"…`);
  const result = await runThemePack(spec, deps);
  await close();
  console.log('[theme] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped });

  if (onlyRoles.length) { console.log('[theme] partial run (THEME_ONLY_ROLES set) — skipping pack assembly'); return; }
  // Assemble the pack from ALL expected pages that now exist in the DB (accumulates
  // across partial/resumed runs), not just the ones this run happened to produce.
  const expectedSlugs = SPEC.pages.map((p) => themePageSlug(BRIEF, SPEC, p));
  await upsertPack(expectedSlugs);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
