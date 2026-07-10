// Generate ONE full-landing page for a family/general dental practice — a FRESH,
// CLEAN look (bright, light, generous whitespace, a single teal/mint accent), whose
// ONE action is "Book an Appointment". Catalog content: the brand is fictional-but-
// realistic ("Brightwell Family Dental") with placeholder contact facts a buyer
// swaps for their own.
//
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-brightwell-dental-landing.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Brightwell Family Dental',
  tagline: 'Gentle, modern dentistry for your whole family',
  audience:
    'families in the neighborhood — busy parents booking for their kids and themselves, and anyone ' +
    'who wants a dentist they can trust, including nervous patients who want gentle, comfort-first care',
  conversionGoal: 'book an appointment',
  primaryCta: 'Book an Appointment',
  accentColorHex: '#0D9488', // fresh teal, used sparingly on bright light backgrounds
  voice:
    'warm, reassuring, and plain-language — comfort-first without hype. Short, friendly sentences a ' +
    'busy parent understands. Trustworthy and welcoming. Never salesy, never clinical-cold. ' +
    'Lead with gentle care, convenience, and a dentist the whole family can trust.',
  // Shared design system carried across every section (fresh & clean): a teal
  // primary + a cyan-teal secondary on light backgrounds, a soft mint tint for the
  // alternating panels, a deep-teal dark panel, slate type.
  palette: {
    primary: '#0D9488',
    secondary: '#0E7490',
    tint: '#F0FDFA',
    dark: '#134E4A',
    heading: '#0F172A',
    body: '#334155',
  },
  designNotes:
    'fresh and clean — bright, generous whitespace, soft rounded cards with one consistent radius and a ' +
    'single soft shadow, thin dividers, a single teal accent used sparingly. Friendly, trustworthy, uncluttered — never loud, never cold',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email, ' +
  'insurance or booking appears, and NEVER invent alternatives or a second phone number: ' +
  'Name: Brightwell Family Dental. A neighborhood family & general dental practice caring for every age ' +
  'under one roof — preventive checkups & cleanings, fillings & crowns, cosmetic (teeth whitening, ' +
  'veneers, bonding), children’s dentistry, Invisalign clear aligners, and same-day emergency dental care. ' +
  'Comfort-first, gentle care with sedation/comfort options for anxious patients; accepting new patients; ' +
  'most insurance accepted; flexible financing and payment plans; easy on-site parking; kids welcome. ' +
  'Phone: (503) 555-0184. Email: hello@brightwelldental.com. Address: 128 Cedar Street, Suite 4, ' +
  'Portland, OR 97205. Hours: Mon–Thu 8:00am–6:00pm; Fri 8:00am–4:00pm; Sat by appointment; closed Sunday. ' +
  'Aesthetic: FRESH and CLEAN — bright light backgrounds (#FFFFFF and soft #F0FDFA mint panels), dark slate ' +
  'text (#0F172A), a SINGLE teal accent (#0D9488) used sparingly on buttons and highlights, generous ' +
  'whitespace, soft rounded cards, no clutter. Friendly, trustworthy, and welcoming — never loud, never cold.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open warm and welcoming: a reassuring headline about gentle, modern dentistry for the whole family. Say who it is for (families in the neighborhood, kids and parents, nervous patients) and the ONE action — Book an Appointment — over a bright, friendly image of a welcoming office or a happy family. Light, spacious, a single teal accent. Mention accepting new patients.', true),
    S('trust', 'features', 'A quiet credibility strip / short trust row: accepting new patients, most insurance accepted, gentle comfort-first care, same-day emergency appointments, kids welcome. Plain, factual, reassuring — no hype.'),
    S('services', 'cards', 'The dental services as clean cards — Checkups & Cleanings, Fillings & Crowns, Teeth Whitening & Cosmetic, Children’s Dentistry, Invisalign Clear Aligners, and Emergency Dental Care. Each card: the service name and a one-line, plain-language note on what it is for. Warm, precise copy.', true),
    S('why', 'features', 'Why families choose Brightwell: the experience — gentle comfort-first care, on-time appointments that respect your schedule, transparent pricing with no surprises, whole-family scheduling under one roof, modern technology, and a friendly team who remembers you. Sell reassurance and convenience, not features.'),
    S('how_it_works', 'cards', 'How it works in 3 simple steps: 1) Book your visit (online or by phone), 2) Come in for a relaxed first exam, 3) Leave with a simple, clear care plan. Make it feel easy and low-stress for new patients.'),
    S('gallery', 'gallery', 'Bright, welcoming photography of the office, the friendly team, and happy patients of all ages — clean, light, high-trust. Warm and inviting, not clinical-cold.'),
    S('team', 'cards', 'Meet the team: a warm face-of-the-practice section introducing the dentist and staff — approachable, credentialed, and genuinely kind. Use bracketed placeholder names and credentials (e.g. [Dr. Name, DDS]), never fabricated as real people. Build trust and familiarity.'),
    S('faq', 'faq', 'Answer the real questions families ask: Are you accepting new patients? Do you take my insurance? I’m nervous about the dentist — how do you help? Do you see kids? What about dental emergencies? Do you offer payment plans? Reassuring, plain-language answers.'),
    S('social_proof', 'testimonials', '2–3 short patient quotes about a gentle, kind experience, an easy visit, and a team that put them at ease (bracketed placeholders, never fabricated as real).', true),
    S('final_cta', 'cta', 'Restate the promise and the one action: Book an Appointment. Warm, clean, minimal — one clear button, contact details and hours nearby.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'medical', style: 'minimal', color: 'light', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  // Same real gates `npm run pipeline` gets — visionCritic, nearDuplicateHashes
  // (excluding this pack's own pages), onEvent, and the render-outcome contract —
  // via the shared factory in pipeline/deps.ts.
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[brightwell]', defaultMaxBudgetUsd: 4 });

  console.log(`[brightwell] generating the Brightwell Family Dental fresh-clean family dentistry landing page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[brightwell] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
