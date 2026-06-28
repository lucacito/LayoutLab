import type { LlmClient } from './llm';
import { extractJson } from './llm';
import type { Target, Guide } from './recipes';
import { buildGenerationPrompt } from './recipes';

export async function generateLayout(
  target: Target,
  deps: { llm: LlmClient; guide: Guide; maxBudgetUsd?: number },
): Promise<{ json: string }> {
  const { system, prompt } = buildGenerationPrompt(target, deps.guide);
  const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
  const obj = extractJson(text); // throws if no JSON
  return { json: JSON.stringify(obj) };
}
