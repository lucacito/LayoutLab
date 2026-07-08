// Generate "The Private Register" — the residences/portfolio page for Maison
// Verity, third page of the brand (after the landing page and the private-
// consultation page). Brief, palette, brand facts, and voice are pinned to the
// same values as scripts/create-maison-verity-consultation.ts so all pages read
// as one premium site.
//
// Run: bash scripts/gen-maison-verity-residences.sh   (sources env, runs this)
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
  role: 'residences', roleLabel: 'Residences',
  flow: [
    S('hero', 'hero', 'A quiet, gallery-page opening: eyebrow "Private Brokerage · By Appointment", a serif headline for the register of homes — e.g. "Residences That Never Reach the Market" — and a subline: a selection of the homes Maison Verity represents and has placed, shown here in confidence; addresses and details are shared only by introduction. The ONE action is Request a Private Consultation. Refined estate photography treatment consistent with the landing page hero.', true),
    S('register', 'gallery', 'The Private Register itself — the page\'s centerpiece. An elegant grid of 6–8 luxury residence photographs (exteriors, gardens, considered interiors — consistent, high-end architectural photography). Captions are discreet, never addresses: a neighbourhood or character line plus a quiet status, e.g. "Presidio Heights — placed privately", "Hillside estate — available by introduction", "Lakeside residence — represented". Generous spacing, hairline rules, no busy overlays.'),
    S('placements', 'cards', 'Recent placements, in confidence: three anonymized engagement cards that echo the brand\'s known outcomes — a Presidio Heights home sold entirely off-market in eleven days above the privately hoped-for figure; a lakeside estate acquired for a buyer before it was ever listed; a family estate settled well above its reserve amid appraisers, counsel, and three heirs. Each card: a serif title (the residence character), two or three lines of quiet narrative, no photos needed. Factual, unhurried, discreet.'),
    S('access', 'features', 'How access to the register works, as calm two-column assurances: Nothing Public (residences are presented only to a vetted circle; no portals, no open houses), By Introduction (as a client you hear of homes before they are ever listed), Under NDA Where Appropriate (photography, address, and provenance shared only once fit is established), One Advisor (a single senior principal manages every introduction). Understated — this is the "why you won\'t find these online" section.'),
    S('faq', 'faq', 'Answer what a register visitor quietly wonders: Why are no addresses or prices shown? (Discretion is the point — details are shared by introduction once fit is established.) How do I see what is currently available? (Request a private consultation; your criteria stay confidential.) Can my home join the register? (Yes — most engagements are $2M–$40M, and fit matters more than figure.) Do buyers pay to access the register? (No — buyer clients gain access through representation, and your search remains confidential.) Plain, direct, confident answers in the established voice.', true),
    S('final_cta', 'cta', 'Deep indigo closing panel: "The next residence may never be listed. Ask us first." One gold button — Request a Private Consultation — and the direct line beneath it: Prefer to speak directly? +1 (310) 274-8615 · inquiries@maisonverity.com. Minimal, still, final. IMPORTANT: the button must be truly horizontally centered — its parent column must be a centered flex column (display flex, column direction, align-items center), never a plain block column, because a button module\'s own center orientation does not move the inline-block button.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'real_estate', style: 'elegant', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[maison-verity]', defaultMaxBudgetUsd: 4 });

  console.log(`[maison-verity] generating the Maison Verity residences (Private Register) page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[maison-verity] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
