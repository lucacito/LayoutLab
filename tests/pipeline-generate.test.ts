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

  it('retries generation when the model returns unparseable JSON, then succeeds', async () => {
    // Fable intermittently over-escapes huge post_content strings, yielding invalid
    // JSON. A fresh generation usually parses cleanly — so retry before giving up.
    const complete = vi
      .fn()
      .mockResolvedValueOnce('{"post_content":"broken\\\\\\"}') // unparseable
      .mockResolvedValueOnce('{"post_title":"OK","post_content":"<!-- x -->"}');
    const { json } = await generateLayout(
      { type: 'full_landing', niche: 'saas', style: 'bold' },
      { llm: { complete }, guide, maxParseRetries: 2 },
    );
    expect(JSON.parse(json).post_title).toBe('OK');
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the failure is a usage limit (surfaces it immediately)', async () => {
    const complete = vi.fn(async () => "You've hit your limit · resets 4:10am");
    await expect(
      generateLayout({ type: 'full_landing', niche: 'saas', style: 'bold' }, { llm: { complete }, guide, maxParseRetries: 3 }),
    ).rejects.toThrow(/limit/);
    expect(complete).toHaveBeenCalledOnce();
  });
});
