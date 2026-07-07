// tests/pipeline-llm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractJson, parseClaudeEnvelope, parseClaudeUsage, claudeCliClient, LlmError } from '@/pipeline/llm';

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

describe('parseClaudeUsage', () => {
  it('reads cost/tokens out of a real-shaped claude -p --output-format json envelope', () => {
    // Full envelope shape the `claude` CLI actually emits in one-shot print mode:
    // top-level `total_cost_usd` + nested `usage.{input,output}_tokens`, alongside
    // fields (session_id, duration_ms, num_turns, cache_*) this codebase doesn't
    // consume — parseClaudeUsage must pick the two fields it cares about and
    // ignore the rest.
    const env = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'hello',
      session_id: 'abc-123',
      duration_ms: 4213,
      duration_api_ms: 3980,
      num_turns: 1,
      total_cost_usd: 0.0182,
      usage: {
        input_tokens: 512,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 1200,
        output_tokens: 340,
        service_tier: 'standard',
      },
    });
    expect(parseClaudeUsage(env)).toEqual({ costUsd: 0.0182, inputTokens: 512, outputTokens: 340 });
  });

  it('omits fields that are absent or non-numeric rather than defaulting to 0', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'x', usage: { input_tokens: 10 } });
    expect(parseClaudeUsage(env)).toEqual({ inputTokens: 10 });
  });

  it('fails open to {} on unparseable stdout', () => {
    expect(parseClaudeUsage('not json')).toEqual({});
  });

  it('fails open to {} when usage/cost fields are the wrong type', () => {
    const env = JSON.stringify({ total_cost_usd: 'free', usage: { input_tokens: '512', output_tokens: null } });
    expect(parseClaudeUsage(env)).toEqual({});
  });

  it('fails open to {} on an error envelope with no usage reported', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'error_max_budget', is_error: true, result: '' });
    expect(parseClaudeUsage(env)).toEqual({});
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

  it('reports usage via onUsage alongside the parsed result text, on success', async () => {
    const run = vi.fn(async () => ({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'hi', total_cost_usd: 0.05, usage: { input_tokens: 20, output_tokens: 10 } }),
      stderr: '',
      code: 0,
    }));
    const client = claudeCliClient({ run });
    const onUsage = vi.fn();
    const out = await client.complete({ prompt: 'x', onUsage });
    expect(out).toBe('hi');
    expect(onUsage).toHaveBeenCalledWith({ costUsd: 0.05, inputTokens: 20, outputTokens: 10 });
  });

  it('never calls onUsage on a non-zero exit (no successful envelope to report from)', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: 'boom', code: 1 }));
    const client = claudeCliClient({ run });
    const onUsage = vi.fn();
    await expect(client.complete({ prompt: 'x', onUsage })).rejects.toBeInstanceOf(LlmError);
    expect(onUsage).not.toHaveBeenCalled();
  });

  it('passes allowedTools through as --allowedTools (T1.3 vision critic file-read access)', async () => {
    const run = vi.fn(async (_cmd: string, _args: string[], _input?: string) => ({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok' }),
      stderr: '',
      code: 0,
    }));
    const client = claudeCliClient({ run });
    await client.complete({ prompt: 'x', allowedTools: ['Read'] });
    const [, args] = run.mock.calls[0];
    expect(args).toContain('--allowedTools');
    expect(args).toContain('Read');
  });

  it('omits --allowedTools when not provided (existing callers unaffected)', async () => {
    const run = vi.fn(async (_cmd: string, _args: string[], _input?: string) => ({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok' }),
      stderr: '',
      code: 0,
    }));
    const client = claudeCliClient({ run });
    await client.complete({ prompt: 'x' });
    const [, args] = run.mock.calls[0];
    expect(args).not.toContain('--allowedTools');
  });
});
