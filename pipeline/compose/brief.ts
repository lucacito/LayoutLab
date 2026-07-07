import type { Target } from '@/pipeline/recipes';
import { extractJson, LlmError } from '@/pipeline/llm';

/** A shared, page-wide design system threaded into EVERY section so a composed
 *  landing reads as one crafted page (consistent colors, tints, dark panel) —
 *  the visual counterpart to the brand cohesion the Brief already provides. */
export interface Palette {
  primary: string;   // main accent — primary buttons, icons, links, highlights
  secondary: string; // supporting accent (secondary buttons, badges)
  tint: string;      // soft panel background used for the alternating rhythm
  dark: string;      // dark section / footer background
  heading: string;   // heading text color
  body: string;      // body text color
}

export interface Brief {
  businessType: string;
  businessName: string;
  tagline: string;
  audience: string;
  conversionGoal: string;
  primaryCta: string;
  accentColorHex: string;
  voice: string;
  /** Optional shared design system carried across every section. Pinned briefs
   *  (themes / single-landing scripts) set it; generated briefs derive one via
   *  `selectPalette` (pipeline/compose/palettes.ts), keyed by style/niche, with
   *  accentColorHex always overriding `primary`. */
  palette?: Palette;
  /** Optional art-direction notes (aesthetic + layout motifs) echoed to every
   *  section, e.g. "clean clinical, generous whitespace, soft rounded cards". */
  designNotes?: string;
}

const FIELDS: (keyof Brief)[] = [
  'businessType', 'businessName', 'tagline', 'audience',
  'conversionGoal', 'primaryCta', 'accentColorHex', 'voice',
];

const SYSTEM =
  'You are a senior conversion copywriter and brand strategist. ' +
  'Respond with ONLY a single JSON object, no prose.';

export function buildBriefPrompt(target: Target): { system: string; prompt: string } {
  const prompt = [
    `Create a landing-page brief for a ${target.style} ${target.niche} business.`,
    'Decide the business type, audience, and the ONE conversion goal, then a concrete',
    'brand identity to carry across the whole page. Return a JSON object with EXACTLY',
    'these fields (all strings):',
    '- businessType: one of SaaS, service/agency, local business, product/e-commerce, course/coaching, event, portfolio, non-profit',
    '- businessName: a concrete, on-brand name (not a placeholder)',
    '- tagline: one short benefit-led line',
    '- audience: who the page speaks to',
    '- conversionGoal: the single primary action',
    '- primaryCta: the exact button label, reused across the page (e.g. "Book a Call")',
    '- accentColorHex: one accent color as a hex string (e.g. "#E4572E")',
    '- voice: a short tone/style note',
    'Output ONLY the JSON object.',
  ].join('\n');
  return { system: SYSTEM, prompt };
}

export function parseBrief(text: string): Brief {
  const obj = extractJson(text) as Record<string, unknown>;
  for (const f of FIELDS) {
    if (typeof obj?.[f] !== 'string' || (obj[f] as string).trim() === '') {
      throw new LlmError(`brief missing required field: ${f}`);
    }
  }
  return Object.fromEntries(FIELDS.map((f) => [f, obj[f]])) as unknown as Brief;
}
