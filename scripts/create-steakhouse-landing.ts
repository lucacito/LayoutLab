// Generate ONE full-landing page in the "Bold Steakhouse" identity (the dark,
// wood-fired, chef's-counter look of the bold-steakhouse hero the user liked).
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-steakhouse-landing.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Ember & Steel',
  tagline: 'A chef’s-counter steakhouse — dry-aged, wood-fired',
  audience: 'people who take a steak dinner seriously and want a front-row counter seat to the fire',
  conversionGoal: 'book a counter seat',
  primaryCta: 'Reserve a Counter Seat',
  accentColorHex: '#C2410C', // ember, used sparingly on near-black
  voice:
    'spare, confident, a little swaggering — short declarative sentences, no fluff. Fire. Steel. Flavor. ' +
    'Let the cooking talk. Cinematic and dark, never cheesy.',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email or ' +
  'booking appears, and NEVER invent alternatives or a second phone number: ' +
  'Name: Ember & Steel. A chef’s-counter steakhouse: every cut dry-aged in-house for 45 days and seared at ' +
  '1,200°F over hardwood embers; six courses, one counter, no printed menu — just whatever walked in that ' +
  'morning. Phone: (415) 555-0187. Email: hello@emberandsteel.com. Address: 88 Pier Street, San Francisco, CA 94111. ' +
  'Hours: Tue–Sat 5:30–11:00pm; closed Sunday and Monday. ' +
  'Aesthetic: DARK and monochrome — near-black backgrounds (#0a0a0a), off-white type, white or thin-outlined ' +
  'buttons, with a single warm ember accent (#C2410C) used sparingly. Bold, cinematic, high-contrast.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open in the register of the existing bold-steakhouse hero: the chef’s-counter promise — dry-aged 45 days, seared at 1,200°F over hardwood embers, six courses at one counter, no printed menu. A short, punchy "Fire. Steel. Flavor."-style headline. Dark, cinematic, ONE action — Reserve a Counter Seat — over a fire/steak image.', true),
    S('why', 'cards', 'Why Ember & Steel is different: 3–4 outcome-led cards — 45-day in-house dry-age, 1,200°F hardwood-ember sear, a six-course chef’s counter, no printed menu (whatever walked in that morning). Craft and outcomes, not features.', true),
    S('experience', 'features', 'The counter night: what it feels like to sit at the fire while the chef cooks in front of you — the pace, the smoke, the quiet swagger. Sell the evening, not a feature list.'),
    S('cuts', 'cards', 'The plates: signature cuts / the six courses as cards — each with the cut or dish name, a mouth-watering one-line description, and a bracketed price placeholder. Bold, hungry copy.', true),
    S('gallery', 'gallery', 'The fire, the cuts, and the room — cinematic, dark, high-contrast steakhouse photography.'),
    S('social_proof', 'testimonials', '2–3 short guest quotes about the counter and the food (bracketed placeholders, never fabricated as real).', true),
    S('final_cta', 'cta', 'Restate the promise and the one action: Reserve a Counter Seat tonight. Minimal, bold, dark.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'steakhouse', style: 'bold', color: 'dark', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  // Followups #1: shared factory (pipeline/deps.ts) wires the SAME real gates
  // `npm run pipeline` gets — visionCritic, nearDuplicateHashes (excluding this
  // pack's own pages), onEvent, and the T2.1 render-outcome contract — instead
  // of a hand-rolled deps object that silently lacked all four.
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[steak]', defaultMaxBudgetUsd: 4 });

  console.log(`[steak] generating the Ember & Steel bold steakhouse landing page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[steak] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
