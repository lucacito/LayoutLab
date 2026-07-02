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
  it('parses a whole-JSON object whose string values contain braces (Divi block markup)', () => {
    // Naive brace counting would slice mid-string at the first `}` inside post_content.
    const obj = { post_title: 'Hero', post_content: '<!-- wp:divi/section {"a":{"b":1}} --><!-- /wp:divi/section -->' };
    expect(extractJson(JSON.stringify(obj))).toEqual(obj);
  });
  it('extracts a brace-heavy JSON object embedded in prose', () => {
    const obj = { post_content: 'x {"k":"v"} } y' };
    const text = `Sure!\n${JSON.stringify(obj)}\nHope that helps.`;
    expect(extractJson(text)).toEqual(obj);
  });
  it('extracts the layout when a conversational preamble immediately precedes the JSON', () => {
    // Fable behavioral shift: on repair/landing prompts it narrates before the JSON.
    const obj = { post_title: 'Contact', post_content: '<!-- wp:divi/section {"m":1} -->' };
    const text = `I'll locate the exact JSON parse error programmatically.${JSON.stringify(obj)}`;
    expect(extractJson(text)).toEqual(obj);
  });
  it('skips a non-JSON brace token in the preamble and finds the real layout', () => {
    // The exact failure mode: prose contains a `{word}` token before the document.
    const obj = { post_title: 'Landing', post_content: '<!-- wp:divi/section {"a":{"b":2}} -->' };
    const text = `I'll fix the {module} structure now.\n${JSON.stringify(obj)}`;
    expect(extractJson(text)).toEqual(obj);
  });
  it('prefers the layout object over an earlier small decoy JSON in prose', () => {
    const obj = { post_title: 'Hero', post_content: 'x {"k":1} y' };
    const text = `Here is an example config {"note":"ignore"} and now the layout:\n${JSON.stringify(obj)}`;
    expect(extractJson(text)).toEqual(obj);
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

  it('surfaces stdout in the error when stderr is empty (e.g. usage-limit messages)', async () => {
    const run = vi.fn(async () => ({
      stdout: "You've hit your limit · resets 11:10pm",
      stderr: '',
      code: 1,
    }));
    const client = claudeCliClient({ run });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/hit your limit/);
  });
});
