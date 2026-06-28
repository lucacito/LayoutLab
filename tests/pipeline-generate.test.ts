import { describe, it, expect, vi } from 'vitest';
import { generateLayout } from '@/pipeline/generate';

const guide = { style: 's', schema: 'sc', examples: ['{"e":1}'] };

describe('generateLayout', () => {
  it('prompts the LLM and returns the extracted JSON string', async () => {
    const llm = { complete: vi.fn(async () => '```json\n{"content":[]}\n```') };
    const { json } = await generateLayout({ type: 'hero', niche: 'saas', style: 'minimal' }, { llm, guide });
    expect(JSON.parse(json)).toEqual({ content: [] });
    expect(llm.complete).toHaveBeenCalledOnce();
    const calls = llm.complete.mock.calls as unknown as Array<[{ prompt: string; system: string; maxBudgetUsd?: number }]>;
    const arg = calls[0]?.[0];
    expect(arg?.prompt).toContain('hero');
  });

  it('throws when the model returns no JSON', async () => {
    const llm = { complete: vi.fn(async () => 'sorry, no') };
    await expect(generateLayout({ type: 'hero', niche: 'saas', style: 'minimal' }, { llm, guide })).rejects.toThrow();
  });
});
