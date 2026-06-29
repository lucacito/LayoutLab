import type { Target } from './matrix';
import type { Violation } from '@/pipeline/validate';

export interface Recipe {
  name: string;
  title: string;
  description: string;
  when: string;
  markup: string;
}

export interface Guide {
  style: string;
  schema: string;
  recipes?: Recipe[];
  examples?: string[]; // fallback when no recipes are loaded
}

// Which valid section recipes to ground each layout type on (structure to imitate).
const RECIPE_BY_TYPE: Record<string, string[]> = {
  hero: ['hero-cta', 'split-image-text'],
  cta: ['newsletter-social', 'hero-cta'],
  features: ['icon-features', 'card-grid-3'],
  pricing: ['card-grid-3', 'stats-counter'],
  testimonials: ['testimonial', 'section-intro'],
  faq: ['icon-features', 'section-intro'],
  footer: ['newsletter-social'],
  header: ['hero-cta'],
  contact: ['contact-form'],
  gallery: ['image-gallery', 'image-carousel'],
  blog: ['blog-feed'],
  full_landing: ['hero-cta', 'card-grid-3'],
};
const DEFAULT_RECIPES = ['hero-cta', 'card-grid-3'];
const MAX_EXAMPLES = 2; // keep the prompt focused + within budget

const SYSTEM =
  'You generate Divi 5 page sections as a single JSON document. ' +
  'You MUST follow the provided Divi 5 schema and style guide exactly and use ONLY ' +
  'block/module types and attribute shapes shown in the example recipes — never invent ' +
  'block types or attributes. Keep the JSON inside every Divi block comment strictly valid. ' +
  'Respond with ONLY the JSON document, no prose.';

// Resolve the example markup strings to ground a target on: matching recipes first,
// falling back to any raw examples the guide carries.
function pickExamples(target: Target, guide: Guide): string[] {
  const recipes = guide.recipes ?? [];
  if (recipes.length) {
    const wanted = RECIPE_BY_TYPE[target.type] ?? DEFAULT_RECIPES;
    const byName = new Map(recipes.map((r) => [r.name, r]));
    const chosen = wanted.map((n) => byName.get(n)).filter((r): r is Recipe => !!r).slice(0, MAX_EXAMPLES);
    const list = chosen.length ? chosen : recipes.slice(0, MAX_EXAMPLES);
    return list.map((r) => `Recipe "${r.name}" — ${r.description}\n${r.markup}`);
  }
  return (guide.examples ?? []).slice(0, MAX_EXAMPLES);
}

export function buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string } {
  const examples = pickExamples(target, guide)
    .map((e, i) => `Example ${i + 1}:\n${e}`)
    .join('\n\n');
  const prompt = [
    `Generate a Divi 5 "${target.type}" section for a ${target.style} ${target.niche} website.`,
    'Write realistic, specific copy for this niche (no lorem ipsum). Use https://picsum.photos/seed/{keyword}/{w}/{h} for any images.',
    '',
    '=== DIVI 5 SCHEMA ===',
    guide.schema,
    '',
    '=== STYLE GUIDE ===',
    guide.style,
    '',
    '=== VALID SECTION RECIPES (copy the structure + attribute shapes; write your own copy) ===',
    examples,
    '',
    'Output ONLY the JSON for the new section (a single object with post_title and post_content).',
  ].join('\n');
  return { system: SYSTEM, prompt };
}

export function buildRepairPrompt(prevJson: string, violations: Violation[]): { system: string; prompt: string } {
  const list = violations.map((v) => `- [${v.code}] ${v.message}${v.path ? ` (at ${v.path})` : ''}`).join('\n');
  const prompt = [
    'The Divi 5 layout you produced failed deterministic validation with these violations:',
    list,
    '',
    'Here is the layout you produced:',
    prevJson,
    '',
    'Fix ONLY what the violations require, keeping the design intent. Output ONLY the corrected JSON.',
  ].join('\n');
  return { system: SYSTEM, prompt };
}
