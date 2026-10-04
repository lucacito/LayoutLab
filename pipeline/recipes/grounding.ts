import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide, Recipe } from './prompts';
import { IMAGE_GUIDE_MARKDOWN } from './image-guide';

// Loads generation grounding from the sibling validator repo: the schema + style
// guide docs and the AI Editor plugin's real, valid section recipes (the same ones
// the get_section_recipes tool serves). No invented schema. Falls back to a couple
// of valid-layout fixtures if the recipes file is absent.
//
// Since the plugin's 4.0.0 rework: (a) recipes carry `{{aied:image:<token>}}` image
// tokens that the plugin resolves at serve time to its own bundled files — we read the
// RAW json, so we resolve them here to remote picsum URLs (resolveRecipeImageTokens);
// (b) the image guide is owned by the pipeline (./image-guide), not scraped from the
// plugin's now-dynamic ImageGuide.php. Everything that touches the validator's
// recipes/fixtures must go through this function.
//
// `log` (minor review fix, T3.3 follow-up): optional, defaults to a no-op so
// existing callers/tests are unaffected. When supplied (buildRunDeps threads
// its shared logger in), a one-line warning is emitted whenever landing/image
// guide extraction comes back `undefined` — file missing, moved/renamed class,
// or the ambiguity guard in `extractHeredocMarkdown` tripped — so a broken
// extraction is observable instead of silently degrading forever.
export function loadGrounding(validatorDir: string, log: (message: string) => void = () => {}): Guide {
  const style = readFileSync(join(validatorDir, 'docs', 'STYLE.md'), 'utf8');
  const schema = readFileSync(join(validatorDir, 'docs', 'SCHEMA.md'), 'utf8');

  let recipes: Recipe[] = [];
  try {
    const raw = readFileSync(join(validatorDir, 'wp-plugin', 'data', 'section-recipes.json'), 'utf8');
    const manifest = readImageManifest(validatorDir);
    recipes = (JSON.parse(raw) as Recipe[]).map((r) => ({
      ...r,
      markup: resolveRecipeImageTokens(r.markup, manifest),
    }));
  } catch {
    recipes = [];
  }

  // T3.3 — LandingGuide.php (per-business-type conversion blueprints) ships ONLY as a
  // PHP nowdoc string (`public static function markdown(): string { return <<<'MD' ... MD; }`).
  // There is no separate markdown/JSON export, so the body is pulled out of the source with
  // one small regex (see extractHeredocMarkdown). Fails soft to `undefined` on ANY problem
  // (missing file, renamed class, ambiguous markers), so every consumer must treat landing
  // guidance as optional. The image guide is NOT extracted: the plugin's ImageGuide.php is
  // dynamic now and describes plugin-local images, so the pipeline owns its own guide.
  const landingGuide = extractHeredocMarkdown(join(validatorDir, 'wp-plugin', 'src', 'LandingGuide.php'));
  const imageGuide = IMAGE_GUIDE_MARKDOWN;
  if (!landingGuide) log('[grounding] LandingGuide.php extraction yielded no guidance (file missing or ambiguous heredoc) — proceeding without it');

  if (recipes.length) return { style, schema, recipes, landingGuide, imageGuide };

  const validDir = join(validatorDir, 'fixtures', 'valid');
  const examples = readdirSync(validDir)
    // `verified-*.json` are bare render-verified module probes, not example layouts.
    .filter((f) => f.endsWith('.json') && !f.startsWith('verified-'))
    .sort()
    .slice(0, 2)
    .map((f) => readFileSync(join(validDir, f), 'utf8'));
  return { style, schema, examples, landingGuide, imageGuide };
}

export interface ImageManifest {
  images?: Array<{ token?: string; width?: number; height?: number }>;
}

const IMAGE_TOKEN_RE = /\{\{aied:image:([^{}\s"\\]+)\}\}/g;
const FALLBACK_IMAGE_SIZE = { width: 1200, height: 800 };

/** Reads the plugin's bundled-image manifest (token -> dimensions). Undefined when absent/corrupt. */
function readImageManifest(validatorDir: string): ImageManifest | undefined {
  try {
    return JSON.parse(readFileSync(join(validatorDir, 'wp-plugin', 'assets', 'images', 'manifest.json'), 'utf8')) as ImageManifest;
  } catch {
    return undefined;
  }
}

/**
 * Replaces the plugin's `{{aied:image:<token>}}` recipe tokens with a deterministic REMOTE
 * placeholder, `https://picsum.photos/seed/<token>/<w>/<h>` (the shape the old recipes used),
 * so layouts exported for customers never carry plugin-local paths or raw tokens. Dimensions
 * come from the manifest entry; a missing manifest or unknown token resolves at 1200x800.
 * Pure; tokens are matched up to the closing braces (no quotes/backslashes), so JSON-escaped markup is safe and no `{{aied:` can survive a well-formed token.
 */
export function resolveRecipeImageTokens(markup: string, manifest?: ImageManifest): string {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const img of manifest?.images ?? []) {
    if (img?.token && Number.isFinite(img.width) && Number.isFinite(img.height)) {
      sizes.set(img.token, { width: img.width as number, height: img.height as number });
    }
  }
  return markup.replace(IMAGE_TOKEN_RE, (_m, token: string) => {
    const { width, height } = sizes.get(token) ?? FALLBACK_IMAGE_SIZE;
    return `https://picsum.photos/seed/${encodeURIComponent(token)}/${width}/${height}`;
  });
}

// Extracts the body of a PHP heredoc block shaped like:
//   return <<<'MD'
//   ...markdown...
//   MD;
// (the exact shape LandingGuide::markdown() returns).
// Intentionally NOT a PHP parser — just a targeted regex for this one known
// shape. Returns undefined (fail-soft) if the file is missing, unreadable, or
// doesn't match — callers must treat the result as optional.
//
// Review fix: a naive non-greedy `<<<'MD'...MD;` match stops at the FIRST
// `\nMD;` line, so a body that itself contains a literal `MD;` line (e.g.
// quoting heredoc syntax in the guide prose), or a file with a second heredoc
// later on, would yield a truthy but SILENTLY TRUNCATED string instead of the
// documented fail-soft `undefined`. Guard against that by requiring the
// opening marker and the line-anchored terminator to each appear EXACTLY ONCE
// in the whole file — if either is ambiguous, bail to `undefined` rather than
// guess which occurrence is "the" terminator.
const HEREDOC_OPEN = /<<<'MD'\r?\n/g;
const HEREDOC_TERMINATOR = /^MD;[ \t]*$/gm;

function extractHeredocMarkdown(phpFile: string): string | undefined {
  try {
    const php = readFileSync(phpFile, 'utf8');
    const openings = [...php.matchAll(HEREDOC_OPEN)];
    const terminators = [...php.matchAll(HEREDOC_TERMINATOR)];
    if (openings.length !== 1 || terminators.length !== 1) return undefined;
    const bodyStart = openings[0].index! + openings[0][0].length;
    const bodyEnd = terminators[0].index!;
    if (bodyEnd < bodyStart) return undefined;
    return php.slice(bodyStart, bodyEnd).replace(/\r?\n$/, '');
  } catch {
    return undefined;
  }
}
