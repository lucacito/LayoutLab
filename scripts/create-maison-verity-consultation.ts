// Generate the "Request a Private Consultation" page for Maison Verity — the
// companion page to the already-published elegant luxury real-estate landing
// (elegant-luxury-real-estate-landing-page-divi-5-layout). Brief, palette, brand
// facts, and voice are pinned to EXACTLY match that page's copy (extracted from
// its Divi JSON) so the two read as one premium site.
//
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-maison-verity-consultation.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'service/agency',
  businessName: 'Maison Verity',
  tagline: 'Exceptional Homes, Represented with Discretion',
  audience:
    'owners and buyers of luxury residences (most engagements $2M–$40M) who value privacy above ' +
    'exposure — sellers who never want a public listing, and buyers seeking homes that change hands ' +
    'before they are ever listed',
  conversionGoal: 'request a private consultation',
  primaryCta: 'Request a Private Consultation',
  accentColorHex: '#9A7B4F', // the landing page's muted gold, used sparingly
  voice:
    'quiet, unhurried, and assured — the measured counsel of a senior principal, never a salesperson. ' +
    'Short declarative sentences. Understatement over superlatives. Speaks of discretion, provenance, ' +
    'and considered process. Never urgent, never gimmicky, no exclamation marks. ' +
    '"You are not hiring a brokerage. You are retaining an advisor."',
  // Pinned to the landing page's exact design system: deep indigo grounds,
  // violet-tinted panels, indigo body text, one muted-gold accent.
  palette: {
    primary: '#9A7B4F',
    secondary: '#3730A3',
    tint: '#F5F3FF',
    dark: '#1E1B4B',
    heading: '#1E1B4B',
    body: '#3730A3',
  },
  designNotes:
    'elegant and hushed — serif display headlines, generous whitespace, soft white cards on faint violet ' +
    '(#F5F3FF) panels, thin hairline dividers, small-caps gold eyebrow labels, the muted gold (#9A7B4F) ' +
    'reserved for buttons and fine accents, deep indigo (#1E1B4B) full-bleed closing panel. Refined and ' +
    'still — never loud, never busy',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, stats, or process claims ' +
  'appear, and NEVER invent alternatives, a second phone number, or different figures: ' +
  'Name: Maison Verity. A private residential brokerage, established 2011 — "Private Brokerage · By ' +
  'Appointment". Advises a select clientele on the acquisition and sale of luxury residences, quietly ' +
  'and entirely on the client\'s terms. Track record: $1.4B in private sales closed; 180+ residences ' +
  'represented; 15 years advising discerning clients. Engagements typically $2M–$40M. Homes represented ' +
  'closed at a median 98.6% of asking in 2025; most residences close within 41 days; off-market ' +
  'placements typically conclude within 60–120 days. One senior principal per client, first conversation ' +
  'to final signature — nothing is handed off. NDA available where appropriate. ' +
  'Phone: +1 (310) 274-8615. Email: inquiries@maisonverity.com. ' +
  'Aesthetic: ELEGANT and HUSHED — faint violet panels (#F5F3FF) alternating with white, deep indigo ' +
  '(#1E1B4B) headings and dark panels, indigo (#3730A3) body text, a SINGLE muted gold accent (#9A7B4F) ' +
  'on buttons, eyebrow labels and fine rules. Serif display type, generous whitespace, unhurried rhythm.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'private-consultation', roleLabel: 'Private Consultation',
  flow: [
    S('hero', 'hero', 'A quiet, purposeful page opening: eyebrow "Private Brokerage · By Appointment", a serif headline inviting one unhurried conversation — e.g. "A Conversation, Held in Confidence" — and a subline promising: one senior advisor, complete confidence, no listings pushed, no obligation created. The ONE action is Request a Private Consultation. Shorter and stiller than a landing hero — this page exists only to begin the conversation. Deep indigo panel or refined light treatment with the gold accent.', true),
    S('how_it_works', 'cards', 'What follows your note, in three deliberate steps: 1) Your inquiry is read by a senior principal — not a team inbox — and answered within one business day. 2) A private conversation, at your residence or ours, where we listen before we speak. 3) A candid assessment — an honest valuation and timeline for sellers, or a first look at our private register for buyers — with no obligation created. Numbered, calm, spacious cards.'),
    S('consultation_form', 'contact', 'The consultation request itself: a refined, uncluttered form (name, email, telephone, and one open field — "Tell us what you are looking for, or what you are ready to part with"). Beside or above it, a short note on discretion: every inquiry is held in complete confidence, NDA available where appropriate. Include the direct alternatives verbatim: +1 (310) 274-8615 · inquiries@maisonverity.com. This is the page\'s centerpiece — give it room.', true),
    S('commitments', 'features', 'The four commitments, restated briefly as quiet assurances for someone about to write: Absolute Discretion (your inquiry and affairs remain yours), One Advisor Throughout (a single senior partner, nothing handed off), Considered Valuation (counsel grounded in comparable sales and provenance, never urgency), A Quiet Network (many residences change hands before they are ever listed). Two-column, understated, no cards-clutter.'),
    S('faq', 'faq', 'Answer only what someone hesitating over the form would ask: Is my inquiry confidential before we ever meet? Must I be ready to sell (or buy) to request a consultation? What does the consultation cost? (Nothing — and a standard commission, agreed in writing, only if we proceed.) How quickly will I hear from you? (A senior principal replies within one business day.) Plain, direct, confident answers in the established voice.'),
    S('final_cta', 'cta', 'Deep indigo closing panel restating the single action: "The finest homes change hands quietly. Yours should too." One gold button — Request a Private Consultation — and the direct line beneath it: Prefer to speak directly? +1 (310) 274-8615 · inquiries@maisonverity.com. Minimal, still, final.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'real_estate', style: 'elegant', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[maison-verity]', defaultMaxBudgetUsd: 4 });

  console.log(`[maison-verity] generating the Maison Verity private-consultation page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[maison-verity] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
