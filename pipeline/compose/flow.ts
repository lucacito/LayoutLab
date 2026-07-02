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

const FLOWS: Record<string, Step[]> = {
  saas: [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL],
  'service/agency': [HERO, PROBLEM, BENEFITS, HOWITWORKS, PROOF, FAQ, FINAL],
  'local business': [HERO, BENEFITS, FEATURES, PROOF, FAQ, FINAL],
  'product/e-commerce': [HERO, PROBLEM, BENEFITS, FEATURES, PROOF, PRICING, FAQ, FINAL],
  'course/coaching': [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL],
};
const DEFAULT_FLOW = FLOWS['service/agency'];

function normalize(bt: string): string {
  const s = bt.toLowerCase();
  if (s.includes('saas')) return 'saas';
  if (s.includes('agency') || s.includes('service')) return 'service/agency';
  if (s.includes('local') || s.includes('restaurant') || s.includes('gym') || s.includes('clinic')) return 'local business';
  if (s.includes('commerce') || s.includes('product') || s.includes('shop')) return 'product/e-commerce';
  if (s.includes('course') || s.includes('coaching')) return 'course/coaching';
  return '';
}

export function flowForBusinessType(businessType: string): Step[] {
  return FLOWS[normalize(businessType)] ?? DEFAULT_FLOW;
}
