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
  full_landing: ['hero-cta', 'icon-features', 'testimonial', 'stats-counter', 'card-grid-3'],
};
const DEFAULT_RECIPES = ['hero-cta', 'card-grid-3'];
const MAX_EXAMPLES = 2; // keep the prompt focused + within budget
// A full landing composes many section types, so it gets a wider grounding set.
const MAX_EXAMPLES_LANDING = 5;

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
  const cap = target.type === 'full_landing' ? MAX_EXAMPLES_LANDING : MAX_EXAMPLES;
  if (recipes.length) {
    const wanted = RECIPE_BY_TYPE[target.type] ?? DEFAULT_RECIPES;
    const byName = new Map(recipes.map((r) => [r.name, r]));
    const chosen = wanted.map((n) => byName.get(n)).filter((r): r is Recipe => !!r).slice(0, cap);
    const list = chosen.length ? chosen : recipes.slice(0, cap);
    return list.map((r) => `Recipe "${r.name}" — ${r.description}\n${r.markup}`);
  }
  return (guide.examples ?? []).slice(0, cap);
}

function directives(target: Target): string {
  const lines = ['Write realistic, specific copy for this niche — real headlines and benefits, no lorem ipsum.'];
  // Hard content bans (a deterministic lint enforces these post-generation and will
  // reject the layout — so get them right the first time).
  lines.push(
    'NEVER ship placeholder or demo content. Specifically forbidden: lorem ipsum; ' +
      'Divi filler like "Your content goes here" or "Edit or remove this text"; the literal word "EYEBROW" ' +
      '(if a section has a small eyebrow/label above the headline, write a REAL short label, e.g. "Established 2014" or "For SaaS teams"); ' +
      'bracketed tokens like "[Replace: …]", "[insert …]", "[$XX/month]"; and "$XX"/"XX per month" price stubs — always use a real number. ' +
      'For any contact details use plausible BRANDED values: an email on the business\'s own domain (never name@example.com) and a realistic phone number (never a 555-01xx "fictional" number).',
  );
  // Layout robustness: the #1 render defect is titles/text overlapping or content
  // spilling past its section, and multi-column rows squeezing text into 1-char-wide
  // columns. Guard against both.
  lines.push(
    'Layout robustness: give every section generous top/bottom padding so headings and text NEVER overlap the next section or an adjacent element; ' +
      'let text wrap naturally (no fixed heights that clip it, no negative margins that pull a title over an image or another block). ' +
      'For any multi-column row (features, pricing, testimonials, galleries) use equal, full-width flex columns — never fixed narrow pixel widths that squeeze text into tall one-word-per-line columns.',
  );
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
  if (target.type === 'full_landing') {
    lines.push(
      'Build a COMPLETE, premium, high-converting landing page — one document with MULTIPLE divi/section blocks in this order: ' +
        '(1) a bold hero: eyebrow, strong headline, subhead, primary + secondary CTA button, and a product/hero image; ' +
        '(2) a trust strip: a row of client logos or 3–4 headline stats; ' +
        '(3) a features/benefits section: icon cards (3 or 4 columns) with real benefits; ' +
        '(4) a "how it works" section: 3 numbered steps; ' +
        '(5) social proof: 2–3 testimonials with avatars and names/roles; ' +
        '(6) a pricing section: 2–3 plans in columns with the middle plan highlighted and feature checklists; ' +
        '(7) an FAQ section: 4–6 question/answer pairs; ' +
        '(8) a final full-width CTA banner. ' +
        'Alternate section backgrounds (light → tinted → dark) for visual rhythm, keep one consistent accent color, and write specific, benefit-led copy throughout — this is a flagship, premium page, so make every section polished and cohesive.',
    );
  }
  lines.push(
    'Design bar (this is a premium marketplace — every section must look like it was crafted by a senior designer): ' +
      'strong typographic hierarchy (large, tight headlines vs comfortable body sizes), generous section padding and whitespace, ' +
      'one deliberate accent color carried through buttons, icons, and highlights, rounded corners + soft shadows where cards appear, ' +
      'and hover polish on interactive elements (buttons and cards lift or deepen their shadow with a smooth transition). ' +
      'Achieve all of this using ONLY the decoration/attribute shapes shown in the recipes — never invent attributes.',
  );
  lines.push(
    'For images, derive a SPECIFIC keyword from the business and use https://loremflickr.com/{w}/{h}/{keyword} for RELEVANT photos ' +
      '(e.g. a steakhouse → "steak,grill", a SaaS dashboard → "dashboard,analytics"); use 2–3 comma-separated keywords so the photo actually matches the subject. ' +
      'For people/avatars (testimonials, team) use https://i.pravatar.cc/{size}?u={unique-id} — and make the testimonial NAME gender-neutral or matched to a generic persona, since the avatar is random (do not pair an obviously gendered name like "Marisol" with an unrelated face). ' +
      'The eyebrow "product/app shot" in a hero must depict the ACTUAL product (a dashboard, an app screen, the product photo) — never a random lifestyle stock image that has nothing to do with what is being sold. ' +
      'Never use placehold.co, never leave an empty "src", and never emit an image whose subject is unrelated to the section.',
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

export interface ContentIssue { code: string; message: string; sample: string }

// Repair copy-quality problems (placeholder tokens, lorem ipsum, demo filler, fake
// contacts/prices, unresolved placeholder images) WITHOUT changing the structure.
export function buildContentRepairPrompt(prevJson: string, issues: ContentIssue[]): { system: string; prompt: string } {
  const list = issues.map((v) => `- [${v.code}] ${v.message} — found near: "${v.sample}"`).join('\n');
  const prompt = [
    'The Divi 5 layout you produced is structurally valid but its COPY is unfinished — it contains placeholder / filler content that must never ship in a paid marketplace:',
    list,
    '',
    'Here is the layout you produced:',
    prevJson,
    '',
    'Rewrite ONLY the offending text values into finished, specific, on-brand copy for this business. Rules:',
    '- No lorem ipsum, no "Your content goes here", no "[Replace: …]" / "[insert …]" tokens, no "EYEBROW" placeholder.',
    '- Real prices (e.g. "$29/mo"), never "$XX".',
    '- Plausible branded contacts — a real-looking email on the business domain, never @example.com; never a 555-01xx phone.',
    '- Every image src must be a real photo URL (keep any https://loremflickr.com/{w}/{h}/{keyword} or https://i.pravatar.cc URLs as-is — those are resolved later — but never leave an empty "src":"" or a placehold.co URL).',
    '- Keep the exact same block structure, attributes, and JSON shape — change text content only.',
    'Output ONLY the corrected JSON.',
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
