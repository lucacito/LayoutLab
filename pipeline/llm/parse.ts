import { LlmError } from './types';

// Pull a JSON value out of model text. The generation prompt asks for ONLY JSON,
// so try the whole string first; then a ```json fence; then scan for an embedded
// balanced {...}/[...] span. Brace matching is string-literal-aware — Divi 5 block
// markup is full of `{`/`}` inside string values, which naive counting mis-slices.
//
// The scan does NOT blindly take the first brace: models (notably Fable on repair
// prompts) narrate before the JSON, e.g. "I'll fix the {module} now.\n{...}". The
// first brace can be a non-JSON prose token (throws) or a small decoy object. So we
// try every {/[ start and return the first span that BOTH parses AND is shaped like
// a layout (post_title/post_content); failing that, the first span that parses at all.
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
  let firstParsed: unknown;
  let attempts = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' && text[i] !== '[') continue;
    const span = sliceBalanced(text, i);
    if (span == null) continue;
    let value: unknown;
    try {
      value = JSON.parse(span);
    } catch {
      continue; // e.g. a `{word}` prose token — keep scanning
    }
    if (isLayoutShaped(value)) return value; // the real document — decisive
    if (firstParsed === undefined) firstParsed = value;
    if (++attempts >= 200) break; // bound cost on pathological input
  }
  if (firstParsed !== undefined) return firstParsed;
  throw new Error('no JSON found in text');
}

// A generated layout is always an object with a string post_title or post_content
// (the generation + repair prompts mandate that shape). Used to pick the real
// document over any decoy JSON the model narrated before it.
function isLayoutShaped(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.post_title === 'string' || typeof o.post_content === 'string';
}

function sliceBalanced(text: string, start: number): string | null {
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
