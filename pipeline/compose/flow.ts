import { pickByRendezvous } from './palettes';

export interface Step {
  role: string;
  sectionType: string;
  job: string;
  cta: boolean;
}

// Section types that pipeline/recipes/prompts.ts can ground (RECIPE_BY_TYPE keys).
export const RECIPE_BY_TYPE_KEYS = [
  'hero', 'cta', 'features', 'cards', 'pricing', 'testimonials', 'faq', 'gallery', 'contact',
] as const;

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

// Persuasion spines from the landing guide, mapped to groundable section types.
const HERO = S('hero', 'hero', 'Say what is offered, who it is for, why it matters, and the ONE primary action, with a relevant visual.', true);
const PROBLEM = S('problem', 'features', 'Name 3 sharp pains the visitor feels today (before-state). No pitch yet.');
const SOLUTION = S('solution', 'features', 'Frame the better way: old-way-vs-new-way, sell the mechanism in plain language.');
const BENEFITS = S('benefits', 'cards', 'Outcome-led benefit cards (icon + title + one line). Write outcomes, not features.', true);
const PROOF = S('social_proof', 'testimonials', 'Reduce risk with 2-3 testimonials (bracketed placeholders, never fabricated as real).', true);
const HOWITWORKS = S('how_it_works', 'cards', '3-4 numbered steps that make the process feel easy.');
const FEATURES = S('features', 'features', 'Feature detail: what it does, why it matters, what changes for the customer.');
const FAQ = S('faq', 'faq', 'Answer the real objections: is it hard, how long, who is it for, cost/guarantee.');
const PRICING = S('pricing', 'pricing', '2-3 plans in columns with the middle plan highlighted and feature checklists.');
const FINAL = S('final_cta', 'cta', 'Restate the promise and the ONE action. Minimal distractions.', true);

/** A named, stable-id flow spine — the same append-stability shape as
 *  `StylePaletteVariant` (palettes.ts) and `RoleTreatment` (section-prompt.ts).
 *  Never derive `id` from array position. */
interface FlowVariant {
  id: string;
  steps: Step[];
}

// 2 spines per main business type — enough structural variety that two pages
// of the same business type don't always walk the exact same persuasion
// order. hero/final_cta are REQUIRED in every variant (compose/index.ts
// enforces this at generation time too).
export const FLOWS: Record<string, FlowVariant[]> = {
  saas: [
    // Classic SaaS: name the pain, frame the mechanism, then prove/price it.
    { id: 'saas-problem-solution', steps: [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL] },
    // Benefits-first: skip the pain framing, lead with outcomes + capability detail.
    { id: 'saas-benefits-first', steps: [HERO, BENEFITS, FEATURES, HOWITWORKS, PROOF, PRICING, FAQ, FINAL] },
  ],
  'service/agency': [
    // Classic agency: pain -> outcome-led benefits -> process -> proof.
    { id: 'service-agency-classic', steps: [HERO, PROBLEM, BENEFITS, HOWITWORKS, PROOF, FAQ, FINAL] },
    // Proof-led: open with credibility before pitching, then process + feature detail.
    { id: 'service-agency-proof-led', steps: [HERO, PROOF, BENEFITS, HOWITWORKS, FEATURES, FAQ, FINAL] },
  ],
  'local business': [
    // Classic local: benefits, then detail, then proof.
    { id: 'local-business-classic', steps: [HERO, BENEFITS, FEATURES, PROOF, FAQ, FINAL] },
    // How-to-emphasis: leads with the process — fits appointment/booking-style
    // businesses (salons, clinics) where "what happens when you book" sells.
    { id: 'local-business-howto', steps: [HERO, HOWITWORKS, BENEFITS, PROOF, FAQ, FINAL] },
  ],
  'product/e-commerce': [
    // Classic product: pain -> benefits -> feature detail -> proof -> price.
    { id: 'product-ecommerce-classic', steps: [HERO, PROBLEM, BENEFITS, FEATURES, PROOF, PRICING, FAQ, FINAL] },
    // Benefits-first: skip the pain framing, straight to outcomes then detail/price.
    { id: 'product-ecommerce-benefits-first', steps: [HERO, BENEFITS, FEATURES, PROOF, PRICING, FAQ, FINAL] },
  ],
  'course/coaching': [
    // Classic transformation spine: pain -> mechanism -> outcomes -> process -> price.
    { id: 'course-coaching-classic', steps: [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL] },
    // Outcomes-first: skip the separate mechanism step, lead with benefits then process.
    { id: 'course-coaching-outcomes-first', steps: [HERO, PROBLEM, BENEFITS, HOWITWORKS, PROOF, PRICING, FAQ, FINAL] },
  ],
};

const DEFAULT_CATEGORY = 'service/agency';

export type UnmatchedLogger = (businessType: string) => void;

interface SignalRule {
  pattern: RegExp;
  category: string;
}

// Priority-ordered keyword signals. The first 5 rules are the primary
// business-type buckets (same priority order as the original normalize()).
// The rules after that catch business-type strings from the Brief's own
// vocabulary (see brief.ts's businessType prompt list: SaaS, service/agency,
// local business, product/e-commerce, course/coaching, event, portfolio,
// non-profit) or free-form LLM output that doesn't literally say one of the
// 5 bucket names, routing each to whichever EXISTING flow fits best instead
// of silently collapsing everything into service/agency:
//   - booking-ish   -> local business (its "howto" variant fits an appointment flow)
//   - event-ish     -> product/e-commerce (events are usually ticketed/priced)
//   - portfolio-ish -> service/agency (showcase work, sell services)
//   - non-profit-ish -> service/agency (cause + impact + ask, no pricing table)
// Anything matching NONE of these is a genuinely new shape — log it (via
// onUnmatched) so the mapping can grow, and fall through to the same
// service/agency default as before.
const SIGNAL_RULES: SignalRule[] = [
  { pattern: /\bsaas\b|\bsoftware\b|\bplatform\b|\bapp\b/i, category: 'saas' },
  { pattern: /\bagency\b|\bconsult|\bstudio\b|\bservice/i, category: 'service/agency' },
  { pattern: /\blocal\b|\brestaurant\b|\bgym\b|\bclinic\b|\bsalon\b|\bcaf[eé]\b/i, category: 'local business' },
  { pattern: /e-?commerce|\bshop\b|\bstore\b|\bretail\b|\bproduct\b/i, category: 'product/e-commerce' },
  { pattern: /\bcourse\b|\bcoaching\b|\bacademy\b|\btraining\b|\bbootcamp\b/i, category: 'course/coaching' },
  { pattern: /\bbook(ing)?\b|\bappointment\b|\bschedul|\breservation\b/i, category: 'local business' },
  { pattern: /\bevent\b|\bconference\b|\bfestival\b|\bsummit\b|\bwedding\b/i, category: 'product/e-commerce' },
  { pattern: /\bportfolio\b|\bfreelance\b|\bphotographer\b|\bcreative\b/i, category: 'service/agency' },
  { pattern: /non-?profit|\bcharity\b|\bngo\b|\bdonat/i, category: 'service/agency' },
];

/** Detect the flow category for a free-form business-type string. Falls
 *  through the signal rules above; if none match, calls `onUnmatched` (so the
 *  mapping can grow — see flow.test.ts) and returns the documented default
 *  category rather than throwing. */
export function normalizeBusinessType(businessType: string, onUnmatched?: UnmatchedLogger): string {
  const s = businessType.toLowerCase();
  for (const rule of SIGNAL_RULES) {
    if (rule.pattern.test(s)) return rule.category;
  }
  onUnmatched?.(businessType);
  return DEFAULT_CATEGORY;
}

export interface FlowSelectionOptions {
  /** Key used to select a variant WITHIN the resolved category (rendezvous
   *  hashing, so it's append-stable — see palettes.ts). Defaults to the raw
   *  `businessType` string. Callers wanting per-landing variety within one
   *  category should pass a key built from STABLE target facts — e.g.
   *  `compose/index.ts` uses `${normalizedBusinessType}|${niche}|${style}`,
   *  the same (style, niche) signal `treatmentKey` in section-prompt.ts uses
   *  for role treatments. Do NOT key on Brief fields like `businessName`:
   *  they're LLM-generated and vary across re-runs of the same Target, which
   *  would make the flow variant (and thus the page structure) non-deterministic
   *  for what should be the same generation. */
  key?: string;
  onUnmatched?: UnmatchedLogger;
}

export function flowForBusinessType(businessType: string, opts: FlowSelectionOptions = {}): Step[] {
  const category = normalizeBusinessType(businessType, opts.onUnmatched);
  const variants = FLOWS[category] ?? FLOWS[DEFAULT_CATEGORY];
  const key = opts.key ?? businessType;
  return pickByRendezvous(key, variants).steps;
}

// T3.3 — LandingGuide's "Step 0 — Decide before you build" section spells out a
// per-business-type persuasion spine as a bulleted list, e.g.:
//   - **SaaS**: hero → problem → solution/product → benefits → how it works → ...
// Its 5 bold labels map 1:1 onto the 5 FLOWS categories above (same business-type
// vocabulary the Brief and normalizeBusinessType already use), which is exactly
// the "clean, guide-derived flow hint" the workorder allows without inventing a
// new schema: pull the guide's OWN sentence for the resolved category and thread
// it into the compose prompts as strategic context alongside (not instead of)
// the deterministic FLOWS spine — flow SELECTION stays the existing rendezvous
// pick; this only enriches what the model is told about why that spine works.
const LANDING_GUIDE_CATEGORY_LABELS: Record<string, string> = {
  saas: 'SaaS',
  'service/agency': 'Service / agency',
  'local business': 'Local business',
  'product/e-commerce': 'Product / e-commerce',
  'course/coaching': 'Course / coaching',
};

/** Look up the LandingGuide's own blueprint sentence for a resolved FLOWS
 *  category (the output of normalizeBusinessType). Fails soft to `undefined`
 *  when `landingGuide` is absent (loadGrounding couldn't extract it), the
 *  category has no known guide label, or the guide's text/heading shape ever
 *  changes underneath this regex — callers must treat this as optional
 *  strategic context, never a hard dependency. */
export function landingBlueprintForCategory(landingGuide: string | undefined, category: string): string | undefined {
  if (!landingGuide) return undefined;
  const label = LANDING_GUIDE_CATEGORY_LABELS[category];
  if (!label) return undefined;
  try {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`-\\s*\\*\\*${escaped}\\*\\*:\\s*([\\s\\S]*?)(?=\\n-\\s*\\*\\*|\\nReorder|$)`);
    const match = landingGuide.match(re);
    if (!match) return undefined;
    const text = match[1].replace(/\s+/g, ' ').trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}
