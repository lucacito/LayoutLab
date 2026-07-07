import type { Target } from './matrix';
import type { Violation } from '@/pipeline/validate';
import { getLibraryExemplars, libraryExemplarsEnabled } from '@/pipeline/library/exemplars';
import { bannedContentProse } from '@/pipeline/content-lint';
import { SECTION_TYPES } from '@/pipeline/recipes/section-types';

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
  /** T3.3 — the validator repo's LandingGuide (per-business-type conversion
   *  blueprints), extracted from LandingGuide.php's heredoc by loadGrounding.
   *  Guide-level (not target-specific): used by compose/flow.ts to look up
   *  strategic context for the resolved business-type category and thread it
   *  into the brief/section prompts. Optional — absent when the file couldn't
   *  be found/parsed; every consumer must degrade gracefully. */
  landingGuide?: string;
  /** T3.3 — the validator repo's ImageGuide (image-selection strategy: keyword
   *  derivation, source-per-role, pinning, aspect ratios), extracted from
   *  ImageGuide.php's heredoc by loadGrounding. Guide-level, like schema/style —
   *  folded into the stable system grounding block when present, and referenced
   *  by the per-call image directive. Optional; absent falls back to the
   *  pre-existing hardcoded image directive text only. */
  imageGuide?: string;
}

// Which valid section recipes to ground each layout type on (structure to imitate).
// T4.3: derived from the SECTION_TYPES registry (pipeline/recipes/section-types.ts) —
// was a hand-maintained literal; exported (was module-private) so
// tests/section-types.test.ts can assert this stays byte-for-byte unchanged.
export const RECIPE_BY_TYPE: Record<string, string[]> = Object.fromEntries(
  Object.entries(SECTION_TYPES)
    .filter(([, entry]) => entry.recipes !== undefined)
    .map(([type, entry]) => [type, entry.recipes as string[]]),
);
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

// T1.4 — CLI-compatible prompt hygiene.
//
// The `claude` CLI (pipeline/llm/claude-cli.ts) applies automatic prompt caching to
// a STABLE `--append-system-prompt` string, but nothing to the (necessarily varying)
// user prompt. Grounding — the Divi 5 schema, style guide, and the curated recipe
// examples for a target's TYPE — is ~20KB and identical for every call that shares a
// type, so moving it into the system prompt makes it cache-eligible; leaving only the
// genuinely target-specific ask (type/niche/style, directives, retrieved library
// exemplars) in the user prompt.
//
// `PROMPT_GROUNDING_IN_SYSTEM=0` reverts to the pre-T1.4 layout (grounding inlined in
// the user prompt, every call) — an escape hatch so the eval harness (T4.1) can A/B
// the two layouts empirically before this is trusted by default in production runs.
export function groundingInSystemEnabled(): boolean {
  return process.env.PROMPT_GROUNDING_IN_SYSTEM !== '0';
}

// Resolve the example markup strings to ground a target on: matching recipes first,
// falling back to any raw examples the guide carries. Depends ONLY on target.type
// (never niche/style/color/variant) so the block below is byte-identical for every
// call sharing a type — the property that makes it cache-eligible.
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

// The STABLE grounding block: schema + style guide + the type-matched curated
// recipe examples. A pure function of (target.type, guide) — never niche, style,
// color, or variant — so it is byte-identical across every call in a run that
// shares a target type, which is what lets the CLI's automatic prompt cache hit.
function stableGroundingBlock(target: Target, guide: Guide): string {
  const recipeExamples = pickExamples(target, guide).map((e, i) => `Example ${i + 1}:\n${e}`);
  const parts = [
    '=== DIVI 5 SCHEMA ===',
    guide.schema,
    '',
    '=== STYLE GUIDE ===',
    guide.style,
    '',
    '=== VALID SECTION RECIPES (copy the structure + attribute shapes; write your own copy) ===',
    recipeExamples.join('\n\n'),
  ];
  // T3.3 — the validator's image-strategy guide is guide-level (never varies by
  // target.type/niche/style/color/variant), so it belongs in the stable,
  // cache-eligible system grounding alongside schema/style/recipes rather than
  // the per-call user-prompt directives. Absent when loadGrounding couldn't
  // extract it — the block below simply omits this section.
  if (guide.imageGuide) {
    parts.push('', '=== IMAGE GUIDE ===', guide.imageGuide);
  }
  return parts.join('\n');
}

// The appended system prompt for a call: the fixed instruction plus (unless the
// escape hatch disables it) the stable grounding block. Generation AND repair
// calls for the same (target.type, guide) build this IDENTICALLY — see
// buildRepairPrompt / buildContentRepairPrompt below — so repair calls are cache
// hits against the generation call's grounding, not a second cold system prompt.
function buildSystemPrompt(target: Target, guide: Guide): string {
  if (!groundingInSystemEnabled()) return SYSTEM;
  return [SYSTEM, '', stableGroundingBlock(target, guide)].join('\n');
}

function directives(target: Target, guide: Guide): string {
  const lines = ['Write realistic, specific copy for this niche — real headlines and benefits, no lorem ipsum.'];
  // Hard content bans (a deterministic lint enforces these post-generation and will
  // reject the layout — so get them right the first time). Single-sourced from
  // pipeline/content-lint.ts's bannedContentProse() so this text can never drift
  // from what the lint regexes actually enforce (T1.4).
  lines.push('NEVER ship placeholder or demo content. Specifically forbidden: ' + bannedContentProse().join(' '));
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
  // T3.3 — when the validator's ImageGuide was loaded (full text lives in the
  // stable system grounding block above — see stableGroundingBlock), point the
  // model at it explicitly and pull its most load-bearing, easy-to-miss rules
  // (aspect-ratio consistency within a grid, one avatar source per section,
  // pinning every URL so nothing reshuffles) into the per-call directive too.
  // Absent guide.imageGuide, this directive is a no-op — the hardcoded rules
  // above are unchanged (fail-soft).
  if (guide.imageGuide) {
    lines.push(
      "Also follow the validator's IMAGE GUIDE included in the system grounding above: derive keywords from the section's specific role (not just the niche), " +
        'keep every image within one grid/row at the SAME aspect ratio, use ONE consistent avatar source/style for every person shown in a section, ' +
        'and pin every image URL (LoremFlickr `?lock={n}`, Picsum `/seed/{keyword}/`, a fixed avatar index) so the same image renders on every load.',
    );
  }
  return lines.join('\n');
}

export function buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string } {
  // Retrieved library exemplars are genuinely target-specific (retrieval matches
  // target.niche) — unlike the curated recipes, they DON'T collapse to the same
  // text across targets of the same type, so they stay in the user prompt in
  // BOTH layouts (system-grounding on or off via the escape hatch below).
  const libExamples = libraryExemplarsEnabled()
    ? getLibraryExemplars(target, {
        k: Number(process.env.LIBRARY_EXEMPLAR_K ?? '2'),
        maxChars: Number(process.env.LIBRARY_EXEMPLAR_MAXCHARS ?? '6000'),
      }).map((e, i) => `Real-world example ${i + 1}:\n${e}`)
    : [];
  const inSystem = groundingInSystemEnabled();
  const promptParts = [
    `Generate a Divi 5 "${target.type}" section for a ${target.style} ${target.niche} website.`,
    directives(target, guide),
  ];
  // T1.4 escape hatch (PROMPT_GROUNDING_IN_SYSTEM=0): fall back to inlining the
  // stable grounding into the user prompt (the pre-T1.4 layout) so the eval
  // harness can A/B system-prompt-grounding vs. user-prompt-grounding.
  if (!inSystem) promptParts.push('', stableGroundingBlock(target, guide));
  if (libExamples.length) {
    promptParts.push(
      '',
      '=== RETRIEVED REAL-WORLD EXAMPLES (target-specific; imitate structure, write your own copy) ===',
      libExamples.join('\n\n'),
    );
  }
  promptParts.push('', 'Output ONLY the JSON for the new section (a single object with post_title and post_content).');
  return { system: buildSystemPrompt(target, guide), prompt: promptParts.join('\n') };
}

export interface ContentIssue { code: string; message: string; sample: string }

// Repair copy-quality problems (placeholder tokens, lorem ipsum, demo filler, fake
// contacts/prices, unresolved placeholder images) WITHOUT changing the structure.
//
// Takes the same (target, guide) the generation call used so buildSystemPrompt()
// produces the IDENTICAL system prompt — a cache hit against the generation call's
// grounding, not a second cold one (T1.4 repair-prompt decision: repairs reuse the
// stable system prompt).
export function buildContentRepairPrompt(
  prevJson: string,
  issues: ContentIssue[],
  target: Target,
  guide: Guide,
): { system: string; prompt: string } {
  const list = issues.map((v) => `- [${v.code}] ${v.message} — found near: "${v.sample}"`).join('\n');
  // Ban-list reminder single-sourced from pipeline/content-lint.ts (T1.4) — cannot
  // drift from the generation directive or the enforced regexes.
  const rules = bannedContentProse().map((p) => `- ${p}`);
  const prompt = [
    'The Divi 5 layout you produced is structurally valid but its COPY is unfinished — it contains placeholder / filler content that must never ship in a paid marketplace:',
    list,
    '',
    'Here is the layout you produced:',
    prevJson,
    '',
    'Rewrite ONLY the offending text values into finished, specific, on-brand copy for this business. Rules:',
    ...rules,
    '- Keep the exact same block structure, attributes, and JSON shape — change text content only.',
    'Output ONLY the corrected JSON.',
  ].join('\n');
  return { system: buildSystemPrompt(target, guide), prompt };
}

// Takes the same (target, guide) the generation call used — see the
// buildContentRepairPrompt comment above; the reasoning is identical here.
export function buildRepairPrompt(
  prevJson: string,
  violations: Violation[],
  target: Target,
  guide: Guide,
): { system: string; prompt: string } {
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
  return { system: buildSystemPrompt(target, guide), prompt };
}
