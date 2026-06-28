import type { Target } from './matrix';
import type { Violation } from '@/pipeline/validate';

export interface Guide {
  style: string;
  schema: string;
  examples: string[];
}

const SYSTEM =
  'You generate Divi 5 page layouts as a single JSON document. ' +
  'You MUST follow the provided Divi 5 schema and style guide exactly and use ONLY ' +
  'block/module types shown in the examples — never invent block types or attributes. ' +
  'Respond with ONLY the JSON document, no prose.';

export function buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string } {
  const examples = guide.examples.map((e, i) => `Example ${i + 1}:\n${e}`).join('\n\n');
  const prompt = [
    `Generate a Divi 5 "${target.type}" section for a ${target.style} ${target.niche} website.`,
    '',
    '=== DIVI 5 SCHEMA ===',
    guide.schema,
    '',
    '=== STYLE GUIDE ===',
    guide.style,
    '',
    '=== VALID EXAMPLES (structure to imitate; do not copy content) ===',
    examples,
    '',
    'Output ONLY the JSON for the new layout.',
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
