// Generate ONE full-landing page for a boutique law firm — a DARK-AUTHORITY
// look (deep navy grounds, warm ivory panels, a single oxblood-burgundy accent,
// serif display headlines) whose ONE action is "Schedule a Consultation".
// Catalog content: the brand is fictional-but-realistic with placeholder
// contact facts a buyer swaps for their own. Fills the `legal` niche gap —
// attorney sites are among the most-requested builds for Divi freelancers.
//
// Reuses the theme pipeline (composeLanding + validate → images → stack →
// dedupe → SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-lawfirm-landing.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Caldwell & Pierce',
  tagline: 'Counsel for the decisions that matter',
  audience:
    'individuals, families, and owner-led businesses facing a legal matter they cannot afford to get ' +
    'wrong — a dispute, a contract, an estate, a divorce — who want a senior attorney, straight answers, ' +
    'and a clear plan, not a case number',
  conversionGoal: 'schedule a consultation',
  primaryCta: 'Schedule a Consultation',
  accentColorHex: '#7C2F33', // oxblood burgundy — used sparingly on buttons and fine accents
  voice:
    'measured, direct, and plain-English — the steady confidence of a senior partner across the table. ' +
    'Short declarative sentences. No legalese, no fear-mongering, no exclamation marks, no "we fight for ' +
    'you" clichés. Speaks of judgment, preparation, and candor: "We will tell you what we would do in ' +
    'your position — even when that advice is not to hire us."',
  // Shared design system carried across every section (dark authority): deep
  // navy grounds and headings, warm ivory alternating panels, slate body text,
  // one oxblood-burgundy accent reserved for buttons and fine rules.
  palette: {
    primary: '#7C2F33',
    secondary: '#1F3A5F',
    tint: '#F6F3EE',
    dark: '#101F33',
    heading: '#101F33',
    body: '#3A4657',
  },
  designNotes:
    'dark authority — serif display headlines, deep navy (#101F33) hero and closing panels, warm ivory ' +
    '(#F6F3EE) alternating sections, generous whitespace, sharp (barely-rounded) cards with one hairline ' +
    'border and a single restrained shadow, small-caps burgundy eyebrow labels, thin hairline dividers, ' +
    'the oxblood accent (#7C2F33) reserved for buttons and fine rules. Established, precise, unhurried — ' +
    'a firm that has nothing to prove. Never loud, never salesy',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email, ' +
  'stats, or practice claims appear, and NEVER invent alternatives, a second phone number, or different ' +
  'figures: Name: Caldwell & Pierce, Attorneys at Law. A boutique law firm, established 1998. Six practice ' +
  'areas: Family Law, Estate Planning & Probate, Business & Contracts, Civil Litigation, Real Estate Law, ' +
  'and Employment Law. Track record: more than 1,200 matters resolved; 60+ years of combined attorney ' +
  'experience; every matter is handled by a named partner — nothing is passed to a junior and forgotten. ' +
  'Free 30-minute initial consultation; clear flat-fee and hourly engagement options quoted in writing ' +
  'before work begins; calls and emails returned within one business day. ' +
  'Phone: (312) 555-0177. Email: intake@caldwellpierce.com. Address: 118 West Monroe Street, Suite 900, ' +
  'Chicago, IL 60603. Hours: Mon–Fri 8:30am–5:30pm; evenings by appointment. ' +
  'Aesthetic: DARK AUTHORITY — deep navy (#101F33) grounds and headings, warm ivory (#F6F3EE) panels, ' +
  'slate (#3A4657) body text, a SINGLE oxblood-burgundy accent (#7C2F33) on buttons, eyebrow labels and ' +
  'fine rules. Serif display type, generous whitespace, hairline dividers. Established and precise — ' +
  'never loud.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open on the deep navy panel with quiet authority: small-caps burgundy eyebrow "Attorneys at Law · Est. 1998", a serif headline about counsel for the decisions that matter, and a subline that says who it is for — individuals, families, and owner-led businesses who want a senior attorney and a clear plan. The ONE action is Schedule a Consultation, with the reassurance "Free 30-minute initial consultation" beside it. Refined photography treatment: a dim, composed office or city-at-dusk image, never a gavel cliché.', true),
    S('trust', 'features', 'A quiet credibility strip on ivory: established 1998 · more than 1,200 matters resolved · 60+ years of combined attorney experience · every matter handled by a named partner. Plain, factual, confident — no badges, no hype.'),
    S('services', 'cards', 'The six practice areas as composed cards — Family Law, Estate Planning & Probate, Business & Contracts, Civil Litigation, Real Estate Law, Employment Law. Each card: the practice name and one plain-English line on what the firm actually does there (e.g. Family Law — divorce, custody, and support, resolved with as little collateral damage as possible). Precise, human copy — never legalese.', true),
    S('why', 'features', 'Why clients choose Caldwell & Pierce — sell judgment and candor, not aggression: Partner-Led (the attorney you meet is the attorney who handles your matter), Straight Answers (plain English, including the answer you may not want), Fees in Writing (flat-fee and hourly options quoted before work begins), Responsive (calls and emails returned within one business day).'),
    S('how_it_works', 'cards', 'What happens when you call, in 3 unintimidating steps: 1) Schedule a consultation (30 minutes, free, confidential), 2) Get an honest assessment and a written fee quote, 3) We take it from there — you get a named partner and a clear plan. Make contacting a law firm feel low-stakes.'),
    S('gallery', 'gallery', 'Composed, dim-lit photography of the firm: the conference room, the library shelves, attorneys in considered conversation, the Monroe Street building. Consistent dark-and-ivory grade, editorial and calm — never stock-photo handshakes or gavels.'),
    S('referral', 'features', 'For owner-led businesses: ongoing outside counsel without the overhead of a legal department. A split section — on one side the promise (a partner who knows your business before the problem arrives), on the other a numbered 01/02/03 list: contracts reviewed before you sign, disputes handled before they become lawsuits, one number to call when something happens. Include a compact contact card with the phone and email and a secondary action. Speak to the business owner here.', true),
    S('faq', 'faq', 'Answer what people actually hesitate over before calling a lawyer: Is the first consultation really free? (Yes — 30 minutes, confidential, no obligation.) How much will this cost? (Flat-fee and hourly options, quoted in writing before work begins.) Will I work with a partner or get handed off? (A named partner handles your matter start to finish.) How long will my case take? (An honest range at the consultation — and candor if the fight is not worth it.) Do I need to bring anything? Plain, direct, reassuring answers.'),
    S('social_proof', 'testimonials', '2–3 short client quotes about straight answers, steady guidance, and feeling like the only client (bracketed placeholders, never fabricated as real people). Quiet serif pull-quote treatment consistent with the dark-authority system.', true),
    S('final_cta', 'cta', 'Deep navy closing panel: restate the promise — "Talk to a partner before you decide anything." One burgundy button — Schedule a Consultation — with the direct line beneath it: (312) 555-0177 · intake@caldwellpierce.com · 118 West Monroe Street, Suite 900, Chicago. Minimal, still, final. IMPORTANT: the button must be truly horizontally centered — its parent column must be a centered flex column (display flex, column direction, align-items center), never a plain block column, because a button module\'s own center orientation does not move the inline-block button.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'legal', style: 'corporate', color: 'dark', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[lawfirm]', defaultMaxBudgetUsd: 4 });

  console.log(`[lawfirm] generating the Caldwell & Pierce dark-authority law firm landing page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[lawfirm] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
