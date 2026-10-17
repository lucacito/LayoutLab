// Generate a coherent 7-page REAL ESTATE theme (Larkspur Home Co., a residential
// brokerage) and assemble it into one paid pack. Same shape as
// create-restaurant-pack.ts: idempotent (re-runs dedupe by content hash, resume by
// page slug, upsert the pack by slug).
//
// Needs (like the main pipeline): the local web app up (ingest → localhost:3000),
// the Docker WP+Divi render env up (divi5val_wpcli:8181, wp-cli memory raised for
// Divi 5.15), the validator, PEXELS + BLOB + INGEST_API_TOKEN + POSTGRES_URL +
// STRIPE_SECRET_KEY in env. Run with:
//   npm run dev            # in another shell (ingest target)
//   set -a && . ./.env.local && set +a && npx tsx scripts/create-real-estate-pack.ts
//
// Smoke test one or two pages first: THEME_ONLY_ROLES=home,listings.
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, packLayouts, layouts } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, themePageSlug, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

// ── The brand (pinned — shared verbatim across all 7 pages) ────────────────────
// Palette is pinned (like Maison Verity) so the whole site reads as one system:
// deep forest green, soft sage-cream panels, one warm brass secondary.
const BRIEF: Brief = {
  businessType: 'service/agency',
  businessName: 'Larkspur Home Co.',
  tagline: 'Find the home. Keep the calm.',
  audience:
    'first-time and move-up home buyers, and homeowners getting ready to sell, in a ' +
    'mid-sized city — people who feel the stakes are high and want a calm, honest guide instead of a hard sell',
  conversionGoal: 'book a free home consultation',
  primaryCta: 'Book a Free Consultation',
  accentColorHex: '#1F6F5C',
  voice:
    'warm, plain-spoken and quietly confident — a neighbor who happens to know the market cold. ' +
    'Short sentences. Specific over vague (names streets, timelines, numbers as bracketed placeholders). ' +
    'Reassuring about the process, never pushy, no exclamation marks, no real-estate cliches ' +
    '("dream home", "nestled", "stunning", "turnkey").',
  palette: {
    primary: '#1F6F5C',
    secondary: '#B8844A',
    tint: '#F3F6F1',
    dark: '#10231F',
    heading: '#14261F',
    body: '#3F4F49',
  },
  designNotes:
    'Fresh, editorial, light and airy: a refined serif for headlines, generous whitespace, soft sage panels, ' +
    'one brass accent used sparingly, large natural-light photography of real homes and streets. ' +
    'Calm and modern, nothing like a stock brokerage template. ' +
    'PHOTO KEYWORDS: only generic, photographable subjects (craftsman bungalow exterior, brick townhome row, front porch, ' +
    'tree-lined street, sunny kitchen interior, living room with big windows, mountain view from a deck) — NEVER a ' +
    'neighborhood, street, town or business name, and never words like vintage, ruin, barn, shack, abandoned, film or ' +
    'black and white. Photos are bright, colour, daytime. People photos only for agent and testimonial portraits. ' +
    'BUTTONS: every button, including secondary ghost buttons, must have a visible text label — never an empty button. ' +
    'Never name a competitor or a real portal (Zillow, Redfin, Realtor.com) in the copy.',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, ' +
  'address, phone, email or booking appears, and NEVER invent alternatives: ' +
  'Name: Larkspur Home Co. Phone: (828) 555-0176. Email: hello@larkspurhome.co. ' +
  'Office: 48 Larkin Street, Suite 2, Asheville, NC 28801. ' +
  'Hours: Mon–Fri 9:00am–6:00pm, Sat 10:00am–4:00pm; Sunday by appointment. ' +
  'Primary action: book a free consultation (buyers and sellers). ' +
  'Brand colors: forest green #1F6F5C, brass #B8844A. ' +
  'Neighborhoods served (use these names): Montford, West Asheville, River Arts District, Biltmore Village, Weaverville, Black Mountain. ' +
  'Property facts, prices, agent names, sale statistics and reviews are PLACEHOLDERS: write them in [square brackets] and never present invented numbers as real.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

// Every page opens on `hero` and closes on `final_cta` (both required by composeLanding).
const PAGES: ThemePage[] = [
  {
    role: 'home', roleLabel: 'Home',
    flow: [
      S('hero', 'hero', 'Welcome visitors to Larkspur Home Co.: buying or selling a home should feel calm. Who it is for, the promise, and the ONE action — Book a Free Consultation — with a bright, inviting photo of a real home.', true),
      S('benefits', 'cards', 'Why people choose Larkspur: 3-4 outcome-led cards (a plain-English guide through every step, honest pricing advice, local knowledge street by street, someone who answers the phone). Outcomes, not features.', true),
      S('featured', 'cards', 'A taste of current homes: 3 listing cards, each with a photo, a one-line description, and bracketed placeholders for price, beds, baths and square feet. Link to the Listings page.'),
      S('how_it_works', 'features', 'How working with us goes, in 4 numbered steps from first conversation to keys (or closing day): what happens, how long it takes, what we handle for you.'),
      S('social_proof', 'testimonials', '2-3 client testimonials from buyers and sellers (bracketed placeholders, never fabricated as real).', true),
      S('final_cta', 'cta', 'Restate the promise and the one action: Book a Free Consultation. Minimal distractions.', true),
    ],
  },
  {
    role: 'listings', roleLabel: 'Listings',
    flow: [
      S('hero', 'hero', 'Introduce the current listings: a calm, curated collection rather than a firehose, and the primary action to book a consultation or a tour.', true),
      S('homes', 'cards', 'Six featured home cards in a grid: photo, neighborhood, a short honest description, and bracketed placeholders for price, beds, baths and square feet. Vary the home types (bungalow, townhome, new build, mountain-view house).', true),
      S('browse', 'features', 'How to browse and tour: save a search, get new listings first, book a private tour — three short blocks that make the next step obvious.'),
      S('gallery', 'gallery', 'A gallery of recently sold homes and street scenes in the neighborhoods served.'),
      S('faq', 'faq', 'Buyer questions: how to schedule a tour, what a pre-approval is, how offers work, what closing costs to expect, how long a purchase takes.'),
      S('final_cta', 'cta', 'Invite them to talk through what they want in a home: Book a Free Consultation.', true),
    ],
  },
  {
    role: 'property', roleLabel: 'Property',
    flow: [
      S('hero', 'hero', 'A single-listing page for one example home: its bracketed address and price, key facts (beds, baths, square feet, lot) and the primary action to schedule a tour.', true),
      S('photos', 'gallery', 'A photo gallery of the home: exterior, kitchen, living room, primary bedroom, yard.'),
      S('highlights', 'features', 'What makes this home special: 4 concrete highlights (light, layout, the kitchen, the yard or view), written as plain observations, not hype.'),
      S('details', 'cards', 'The facts at a glance as cards: bedrooms, bathrooms, square feet, lot size, year built, parking, taxes, HOA — bracketed placeholders.'),
      S('neighborhood', 'features', 'The neighborhood around it: walkability, schools, coffee, parks, commute — with bracketed placeholders for distances.'),
      S('contact', 'contact', 'Schedule a tour: canonical phone, email and hours, plus a tour-request form (name, email, phone, preferred day).'),
      S('final_cta', 'cta', 'A final nudge to see it in person: Book a Free Consultation. One action.', true),
    ],
  },
  {
    role: 'sell', roleLabel: 'Sell Your Home',
    flow: [
      S('hero', 'hero', 'For homeowners getting ready to sell: promise a clear, honest answer to "what is my home worth?" and the primary action — Book a Free Consultation — to get a pricing plan.', true),
      S('benefits', 'cards', 'Why sell with Larkspur: 4 outcome-led cards (priced right the first time, prepared and photographed beautifully, handled end to end, no pressure to commit). Outcomes, not features.', true),
      S('how_it_works', 'features', 'The selling plan in 5 numbered steps: consultation and pricing, prep and photos, launch, offers and negotiation, closing — with a realistic timeline for each.'),
      S('social_proof', 'testimonials', '2-3 seller testimonials about price and calm (bracketed placeholders, never fabricated as real).', true),
      S('faq', 'faq', 'Seller questions: what is my home worth, what does it cost to sell, do I need to renovate, how long will it take, can I buy and sell at the same time.'),
      S('contact', 'contact', 'Request a home valuation: canonical phone and email, plus a form (name, email, phone, property address).'),
      S('final_cta', 'cta', 'Restate the promise: a clear plan and a fair price. Book a Free Consultation.', true),
    ],
  },
  {
    role: 'neighborhoods', roleLabel: 'Neighborhoods',
    flow: [
      S('hero', 'hero', 'Introduce the areas Larkspur knows best and why local knowledge changes the outcome, with the primary action.', true),
      S('areas', 'cards', 'Six neighborhood cards using the canonical neighborhood names: photo, a one-line personality, and bracketed placeholders for typical price range and commute.', true),
      S('guide', 'features', 'How we help you choose: 3-4 blocks on matching a neighborhood to how you actually live (walkability, space, schools, commute, quiet).'),
      S('gallery', 'gallery', 'Street scenes and local favorites across the neighborhoods.'),
      S('final_cta', 'cta', 'Invite them to talk it through with someone who lives here: Book a Free Consultation.', true),
    ],
  },
  {
    role: 'about', roleLabel: 'About',
    flow: [
      S('hero', 'hero', 'Our story: why Larkspur Home Co. exists and what it stands for, in a warm, founder-led voice.', true),
      S('values', 'features', 'What we believe: honesty about the market, a calm process, and treating every home as someone\'s whole life — the three ideas that run the office.'),
      S('people', 'cards', 'The team behind Larkspur: 3-4 agents as cards (bracketed name, role, one personal line, years in the neighborhood) with placeholder portraits.'),
      S('proof', 'testimonials', 'Client love and local recognition (bracketed placeholders, never fabricated as real).', true),
      S('final_cta', 'cta', 'Warmly invite the reader to start a conversation: Book a Free Consultation.', true),
    ],
  },
  {
    role: 'contact', roleLabel: 'Contact',
    flow: [
      S('hero', 'hero', 'Talk to Larkspur: a warm one-liner that says a real person answers, and the primary action.', true),
      S('contact', 'contact', 'Full contact block: canonical office address, phone, email, hours and a message form (name, email, phone, buying or selling).'),
      S('faq', 'faq', 'Common questions: is the first consultation really free, do you work with first-time buyers, which areas do you cover, how quickly will you reply.'),
      S('final_cta', 'cta', 'Invite them to book a time that suits them: Book a Free Consultation.', true),
    ],
  },
];

const SPEC: ThemeSpec = { niche: 'real_estate', style: 'minimal', color: 'green', brief: BRIEF, brandFacts: BRAND_FACTS, pages: PAGES };

// ── Pack metadata ──────────────────────────────────────────────────────────────
const PACK_SLUG = 'larkspur-real-estate-theme';
const PACK_TITLE = 'Larkspur — Fresh Real Estate Theme (7 Pages)';
const PRICE_CENTS = 1200; // $12, same as the Bella Nota and Blackline packs
const DESCRIPTION =
  'Everything a real estate agent or small brokerage needs to launch a credible website — seven ' +
  'coherent Divi 5 pages that already share one fresh, editorial identity. Home, Listings, a ' +
  'single Property page, Sell Your Home, Neighborhoods, About and Contact, all built on one brand voice, ' +
  'one forest-green and brass palette and one consistent set of office, phone and booking details — so you ' +
  'swap in your own name, listings and photos and go live in an afternoon. This is not seven stock ' +
  'templates in a folder: it is a real real-estate website. The Home page earns trust, the Listings and ' +
  'Property pages make people want a tour, the Sell page turns an owner into a valuation request, and the ' +
  'Contact page turns a browse into a booking — every headline written like a senior copywriter wrote it, ' +
  'every section validated and checked in a real Divi render. No lorem ipsum, no broken layouts, no ' +
  '"your content here." One simple commercial license, unlimited client sites.';
const PACK_SEO = {
  metaTitle: 'Larkspur — Fresh Real Estate Theme for Divi 5 (7 Coherent Pages) | Divi5Lab',
  metaDescription:
    'A complete 7-page Divi 5 real estate website theme — Home, Listings, Property, Sell, Neighborhoods, ' +
    'About & Contact — one fresh brand, senior-level copy, real booking details. Launch a credible ' +
    'real estate site in an afternoon. $12.',
  keywords: [
    'divi 5 real estate theme', 'real estate website template', 'divi real estate pack',
    'realtor website template', 'divi 5 multi-page theme', 'real estate agent website divi',
  ],
};

async function upsertPack(slugs: string[]): Promise<void> {
  const rows = await db
    .select({ id: layouts.id, slug: layouts.slug, previews: layouts.previewImageKeys })
    .from(layouts).where(inArray(layouts.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const found = slugs.filter((s) => bySlug.has(s));
  if (found.length === 0) { console.error('no real estate pages found in DB — did ingest run?'); process.exitCode = 1; return; }
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
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[theme]', defaultMaxBudgetUsd: 1 });

  // Optional smoke-test knob: THEME_ONLY_ROLES=home,listings limits which pages generate.
  const onlyRoles = (process.env.THEME_ONLY_ROLES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const spec: ThemeSpec = onlyRoles.length ? { ...SPEC, pages: SPEC.pages.filter((p) => onlyRoles.includes(p.role)) } : SPEC;

  console.log(`[theme] generating ${spec.pages.length} ${spec.niche} pages for "${BRIEF.businessName}"…`);
  const result = await runThemePack(spec, deps);
  await close();
  console.log('[theme] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped });

  if (onlyRoles.length) { console.log('[theme] partial run (THEME_ONLY_ROLES set) — skipping pack assembly'); return; }
  const expectedSlugs = SPEC.pages.map((p) => themePageSlug(BRIEF, SPEC, p));
  await upsertPack(expectedSlugs);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
