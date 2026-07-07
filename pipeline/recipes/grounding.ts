import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide, Recipe } from './prompts';

// Loads generation grounding from the sibling validator repo: the schema + style
// guide docs and the AI Editor plugin's real, valid section recipes (the same ones
// the get_section_recipes tool serves). No invented schema. Falls back to a couple
// of valid-layout fixtures if the recipes file is absent.
export function loadGrounding(validatorDir: string): Guide {
  const style = readFileSync(join(validatorDir, 'docs', 'STYLE.md'), 'utf8');
  const schema = readFileSync(join(validatorDir, 'docs', 'SCHEMA.md'), 'utf8');

  let recipes: Recipe[] = [];
  try {
    const raw = readFileSync(join(validatorDir, 'wp-plugin', 'data', 'section-recipes.json'), 'utf8');
    recipes = JSON.parse(raw) as Recipe[];
  } catch {
    recipes = [];
  }

  // T3.3 — LandingGuide.php (per-business-type conversion blueprints) and
  // ImageGuide.php (image-selection strategy) ship ONLY as PHP heredoc strings
  // (`public static function markdown(): string { return <<<'MD' ... MD; }`).
  // There is no separate markdown/JSON export of either anywhere in the
  // validator repo (checked docs/ and wp-plugin/data/: docs/STYLE.md and
  // docs/SCHEMA.md loaded above are hand-authored docs, NOT PHP exports —
  // StyleGuide.php's own markdown() is verifiably different text). Since no
  // clean export exists, this does the minimal robust thing rather than
  // reimplementing a PHP parser: pull the heredoc BODY out of the source with
  // one small regex. Fails soft to `undefined` on ANY problem — missing file,
  // renamed/moved class, changed heredoc marker — so every consumer must treat
  // landing/image guidance as optional and degrade gracefully without it.
  const landingGuide = extractHeredocMarkdown(join(validatorDir, 'wp-plugin', 'src', 'LandingGuide.php'));
  const imageGuide = extractHeredocMarkdown(join(validatorDir, 'wp-plugin', 'src', 'ImageGuide.php'));

  if (recipes.length) return { style, schema, recipes, landingGuide, imageGuide };

  const validDir = join(validatorDir, 'fixtures', 'valid');
  const examples = readdirSync(validDir)
    .filter((f) => f.endsWith('.json'))
    .slice(0, 2)
    .map((f) => readFileSync(join(validDir, f), 'utf8'));
  return { style, schema, examples, landingGuide, imageGuide };
}

// Extracts the body of a PHP heredoc block shaped like:
//   return <<<'MD'
//   ...markdown...
//   MD;
// (the exact shape LandingGuide::markdown() / ImageGuide::markdown() return).
// Intentionally NOT a PHP parser — just a targeted regex for this one known
// shape. Returns undefined (fail-soft) if the file is missing, unreadable, or
// doesn't match — callers must treat the result as optional.
function extractHeredocMarkdown(phpFile: string): string | undefined {
  try {
    const php = readFileSync(phpFile, 'utf8');
    const match = php.match(/<<<'MD'\r?\n([\s\S]*?)\r?\nMD;/);
    return match?.[1];
  } catch {
    return undefined;
  }
}
