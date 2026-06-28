import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide } from './prompts';

// Loads generation grounding from the sibling validator repo: the schema + style
// guide docs and a couple of real valid-layout fixtures. No invented schema.
export function loadGrounding(validatorDir: string): Guide {
  const style = readFileSync(join(validatorDir, 'docs', 'STYLE.md'), 'utf8');
  const schema = readFileSync(join(validatorDir, 'docs', 'SCHEMA.md'), 'utf8');
  const validDir = join(validatorDir, 'fixtures', 'valid');
  const examples = readdirSync(validDir)
    .filter((f) => f.endsWith('.json'))
    .slice(0, 2)
    .map((f) => readFileSync(join(validDir, f), 'utf8'));
  return { style, schema, examples };
}
