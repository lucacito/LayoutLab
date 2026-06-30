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
  cards: ['icon-values', 'blurb-grid', 'card-grid-3'],
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

function directives(target: Target): string {
  const lines = ['Write realistic, specific copy for this niche — real headlines and benefits, no lorem ipsum.'];
  if (target.color) lines.push(`Use a ${target.color} color palette.`);
  if (target.layout) lines.push(`Composition: ${target.layout}.`);
  if (target.type === 'cards') {
    const v = target.variant;
    const cols = v?.columns ?? 3;
    lines.push(
      `Build a section of ${cols} equal-width card columns. Each card IS the divi/column, styled as the wrapper: a white (or, for dark/colored sets, a tinted) background, rounded corners (decoration.border.radius ~20px), generous padding (~36px), and a soft box shadow. On hover the card lifts — set the column's hover decoration: transform translate Y about -6px plus a deeper box shadow and a smooth transition.`,
    );
    const placement = v?.icons === 'left' ? 'to the left of the heading' : 'centered above the heading';
    if (v?.iconStyle === 'number') {
      lines.push(`Put a numbered step badge (1, 2, 3 …) ${placement}: a number inside a filled circle (decoration.border.radius 50%, colored background, contrasting text). No icon glyph.`);
    } else {
      const badge = v?.iconStyle === 'circle' ? 'inside a filled circular badge (colored background, border.radius 50%)' : 'as a bare icon with no background';
      lines.push(`Give each card a Divi icon ${placement}, ${badge}. Use a divi/blurb (or divi/icon) with type:"divi" or type:"fa" and a real glyph matching the card topic — choose glyph unicodes ONLY from the grounding recipes (icon-features, blurb-grid, icon-values); never invent icon codes.`);
    }
    lines.push('Each card: the icon/badge + a short heading + 1–2 specific sentences; optionally a small text link or button. Real copy, no lorem ipsum.');
  }
  lines.push(
    'For images, derive a keyword from the business and use https://loremflickr.com/{w}/{h}/{keyword} for RELEVANT photos ' +
      '(e.g. a restaurant → "restaurant,food"); for people/avatars (testimonials, team) use https://i.pravatar.cc/{size}?u={unique-id}; ' +
      'for plain placeholders use https://placehold.co/{w}x{h}. Pick images that actually fit the business — never a random/mismatched photo, never an empty src.',
  );
  return lines.join('\n');
}

export function buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string } {
  const examples = pickExamples(target, guide)
    .map((e, i) => `Example ${i + 1}:\n${e}`)
    .join('\n\n');
  const prompt = [
    `Generate a Divi 5 "${target.type}" section for a ${target.style} ${target.niche} website.`,
    directives(target),
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
