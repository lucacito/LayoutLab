import type { LlmClient } from './llm';
import { extractJson, LlmError } from './llm';
import type { Target, Guide } from './recipes';
import { buildGenerationPrompt } from './recipes';

// Large full landings occasionally come back as unparseable JSON — Fable
// intermittently over-escapes the huge post_content string. A fresh generation
// almost always parses, so retry a couple of times before giving up. A usage-limit
// message is not retryable (the next attempt would just hit the same wall), so
// surface it immediately.
function isUsageLimit(text: string): boolean {
  return /hit your limit|usage limit|rate.?limit/i.test(text);
}

export async function generateLayout(
  target: Target,
  deps: { llm: LlmClient; guide: Guide; maxBudgetUsd?: number; maxParseRetries?: number },
): Promise<{ json: string }> {
  const { system, prompt } = buildGenerationPrompt(target, deps.guide);
  const maxAttempts = 1 + (deps.maxParseRetries ?? 0);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
    if (isUsageLimit(text)) throw new LlmError(`generation blocked by usage limit: ${text.slice(0, 120)}`);
    try {
      return { json: JSON.stringify(extractJson(text)) };
    } catch (e) {
      lastErr = e; // unparseable model output — retry with a fresh generation
    }
  }
  throw lastErr;
}
