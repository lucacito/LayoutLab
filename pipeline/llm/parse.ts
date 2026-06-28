import { LlmError } from './types';

// Pull a JSON value out of model text: a ```json fence if present, else the
// first balanced {...} or [...] span.
export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fence ? fence[1] : sliceBalanced(text);
  if (candidate == null) throw new Error('no JSON found in text');
  return JSON.parse(candidate.trim());
}

function sliceBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(start, i + 1);
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
