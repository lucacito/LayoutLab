// Generate ONE full-landing page for a LUXURY COSMETIC / smile-design dental studio —
// a DARK & DRAMATIC look (near-black charcoal, cream serif display, a restrained
// champagne-gold accent, editorial whitespace), whose ONE action is "Book a Smile
// Consultation". Deliberate contrast to the fresh-clean family Brightwell page.
// Catalog content: the brand is fictional-but-realistic ("Aurelia Smile Studio") with
// placeholder contact facts a buyer swaps for their own.
//
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-aurelia-cosmetic-landing.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Aurelia Smile Studio',
  tagline: 'Artistry-led cosmetic dentistry — a smile designed for you',
  audience:
    'people finally ready to invest in their smile — professionals, brides, anyone self-conscious about ' +
    'their teeth for years who wants a natural, confident, hand-crafted result from a cosmetic specialist, ' +
    'not a general dentist',
  conversionGoal: 'book a smile consultation',
  primaryCta: 'Book a Smile Consultation',
  accentColorHex: '#C6A15B', // champagne gold, used sparingly on near-black backgrounds
  voice:
    'confident, refined, and aspirational — warm and reassuring, never clinical-cold and never salesy. ' +
    'Sells the transformation and the craftsmanship, not procedures. Speaks to someone who has wanted this ' +
    'for years and is finally ready. Elegant, unhurried, high-trust. Lead with artistry, a natural result, ' +
    'and a guided, private experience.',
  // Shared design system carried across every section (dark luxury): a champagne-gold
  // accent on near-black charcoal, warm espresso alternating panels, a warm ivory light
  // "breather" panel, cream serif headlines, warm-stone body type.
  palette: {
    primary: '#C6A15B',
    secondary: '#2A2320',
    tint: '#F7F2EA',
    dark: '#14110F',
    heading: '#F5F0E8',
    body: '#C9C1B5',
  },
  designNotes:
    'dark and dramatic luxury — near-black charcoal backgrounds, cream serif display headlines with a fine ' +
    'sans body, generous editorial whitespace, thin gold hairline rules, one consistent card radius, and a ' +
    'single restrained champagne-gold accent used sparingly on buttons and highlights. Dramatic photography. ' +
    'Feels like a luxury brand or a high-end spa — never loud, never cheap, never clinical-cold.',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email, ' +
  'financing or booking appears, and NEVER invent alternatives or a second phone number: ' +
  'Name: Aurelia Smile Studio. A cosmetic & aesthetic dentistry studio focused on smile design — porcelain ' +
  'veneers, complete smile makeovers, professional teeth whitening, cosmetic bonding, Invisalign clear ' +
  'aligners, and implant aesthetics. Artistry-led: a board-certified cosmetic focus, hand-crafted porcelain ' +
  'made with a master ceramist, and a complimentary smile consultation that includes a DIGITAL SMILE PREVIEW ' +
  'so you see your new smile before you commit. Private, unhurried by-appointment visits; comfort and ' +
  'sedation options; flexible financing and monthly payment plans; accepting new patients. ' +
  'Phone: (310) 555-0172. Email: hello@aureliasmilestudio.com. Address: 450 Camden Drive, Suite 300, ' +
  'Beverly Hills, CA 90210. Hours: Mon–Thu 9:00am–6:00pm; Fri 9:00am–4:00pm; Sat by appointment; closed Sunday. ' +
  'Aesthetic: DARK and DRAMATIC luxury — near-black charcoal backgrounds (#14110F and warm espresso #2A2320 ' +
  'panels), cream serif display headlines (#F5F0E8), warm-stone body text (#C9C1B5), a SINGLE champagne-gold ' +
  'accent (#C6A15B) used sparingly on buttons and highlights, with a few warm ivory (#F7F2EA) light panels for ' +
  'contrast. Editorial whitespace, thin gold hairline rules. Elegant, aspirational, and high-trust — never ' +
  'loud, never cheap, never clinical-cold.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open aspirational and elegant: a serif display headline about a smile designed for you — natural, confident, hand-crafted. Say who it is for (someone finally ready to invest in their smile) and the ONE action — Book a Smile Consultation — over a dramatic dark hero image. Mention the complimentary consultation includes a digital smile preview so they see the result before committing. Near-black, cream type, a single gold accent. Luxury, not clinical.', true),
    S('credibility', 'features', 'A quiet authority strip / short row: cosmetic-focused practice, digital smile design, hand-crafted porcelain made with a master ceramist, [years] of transformations, and flexible financing. Understated and factual — no hype, no clutter.'),
    S('treatments', 'cards', 'The signature cosmetic treatments as elegant cards — Porcelain Veneers, Complete Smile Makeover, Professional Whitening, Cosmetic Bonding, Invisalign Clear Aligners, and Implant Aesthetics. Each card: the treatment name and one refined, plain-language line on what it is for. Precise, aspirational copy — never salesy.', true),
    S('transformations', 'gallery', 'The centerpiece: dramatic before/after smile transformations — real-result feel, editorial and high-trust, showing natural, beautiful outcomes. This is what sells cosmetic dentistry. Warm, luxurious, confident photography (bracketed placeholder imagery, never fabricated as specific real patients).'),
    S('experience', 'features', 'The Aurelia experience: a private, unhurried studio; a digital smile PREVIEW before you commit; a master-ceramist partnership for hand-crafted porcelain; comfort and sedation options; and a guided, concierge feel. Sell the reassurance and the feeling of being cared for, not a feature list.'),
    S('how_it_works', 'cards', 'How it works in 3 guided steps: 1) Complimentary smile consultation, 2) Your Digital Smile Design preview, 3) Your transformation. Make a big, high-stakes decision feel safe, guided, and completely in your control.'),
    S('team', 'cards', 'Meet your cosmetic dentist: a warm, credentialed artist behind the smiles — approachable and expert. Use bracketed placeholder names and credentials (e.g. [Dr. Name, DDS]), never fabricated as real people. Build trust through artistry and expertise.'),
    S('faq', 'faq', 'Answer the real, high-stakes questions cosmetic patients ask: What does it cost and do you offer financing? Does it hurt? How long does the process take? Will veneers look natural? Are they permanent? Am I a candidate? Honest, reassuring, plain-language answers.'),
    S('social_proof', 'testimonials', '2–3 short, emotional transformation stories about the confidence a new smile gave them and the calm, expert experience (bracketed placeholders, never fabricated as real people).', true),
    S('final_cta', 'cta', 'Restate the promise and the one action: Book a Smile Consultation. Elegant, dark, minimal — one clear gold button, with the address, phone, and hours nearby.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'medical', style: 'bold', color: 'dark', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  // Same real gates `npm run pipeline` gets — visionCritic, nearDuplicateHashes
  // (excluding this pack's own pages), onEvent, and the render-outcome contract —
  // via the shared factory in pipeline/deps.ts.
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[aurelia]', defaultMaxBudgetUsd: 4 });

  console.log(`[aurelia] generating the Aurelia Smile Studio dark-luxury cosmetic dentistry landing page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[aurelia] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
