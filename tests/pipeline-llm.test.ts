// tests/pipeline-llm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractJson, parseClaudeEnvelope, claudeCliClient, LlmError } from '@/pipeline/llm';

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses JSON inside a ```json fence with prose around it', () => {
    const t = 'Here you go:\n```json\n{"b":[1,2]}\n```\nDone.';
    expect(extractJson(t)).toEqual({ b: [1, 2] });
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parseClaudeEnvelope', () => {
  it('returns the result text on success', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'hello' });
    expect(parseClaudeEnvelope(env)).toBe('hello');
  });
  it('throws on is_error true', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'error_max_budget', is_error: true, result: '' });
    expect(() => parseClaudeEnvelope(env)).toThrow(LlmError);
  });
  it('throws on unparseable stdout', () => {
    expect(() => parseClaudeEnvelope('not json')).toThrow(LlmError);
  });
});

describe('claudeCliClient', () => {
  it('passes the prompt via stdin and returns parsed result text', async () => {
    const run = vi.fn(async (_cmd: string, _args: string[], input?: string) => ({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: `echo:${input}` }),
      stderr: '',
      code: 0,
    }));
    const client = claudeCliClient({ run });
    const out = await client.complete({ prompt: 'make a hero', maxBudgetUsd: 1 });
    expect(out).toBe('echo:make a hero');
    const [cmd, args] = run.mock.calls[0];
    expect(cmd).toBe('claude');
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--max-budget-usd');
  });

  it('throws LlmError on a non-zero exit', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: 'boom', code: 1 }));
    const client = claudeCliClient({ run });
    await expect(client.complete({ prompt: 'x' })).rejects.toBeInstanceOf(LlmError);
  });
});
