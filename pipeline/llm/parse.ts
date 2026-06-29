import { LlmError } from './types';

// Pull a JSON value out of model text. The generation prompt asks for ONLY JSON,
// so try the whole string first; then a ```json fence; then the first balanced
// {...}/[...] span. Brace matching is string-literal-aware — Divi 5 block markup
// is full of `{`/`}` inside string values, which naive counting mis-slices.
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* not pure JSON — fall through */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fenced content not parseable on its own — fall through */
    }
  }
  const candidate = sliceBalanced(text);
  if (candidate == null) throw new Error('no JSON found in text');
  return JSON.parse(candidate.trim());
}

function sliceBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function parseClaudeEnvelope(stdout: string): string {
  let env: { subtype?: string; is_error?: boolean; result?: string };
  try {
    env = JSON.parse(stdout);
  } catch {
    throw new LlmError(`claude CLI returned non-JSON output: ${stdout.slice(0, 200)}`);
  }
  if (env.is_error || env.subtype !== 'success' || typeof env.result !== 'string') {
    throw new LlmError(`claude CLI error (subtype=${env.subtype}): ${env.result ?? ''}`);
  }
  return env.result;
}
