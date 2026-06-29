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
  if (recipes.length) return { style, schema, recipes };

  const validDir = join(validatorDir, 'fixtures', 'valid');
  const examples = readdirSync(validDir)
    .filter((f) => f.endsWith('.json'))
    .slice(0, 2)
    .map((f) => readFileSync(join(validDir, f), 'utf8'));
  return { style, schema, examples };
}
