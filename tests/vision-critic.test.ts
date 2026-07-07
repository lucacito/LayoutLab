// tests/vision-critic.test.ts — T1.3 visual QA gate.
//
// `scoreScreenshots` is CLI-native (constraint #1): it shells out to `claude -p`
// via the same `RunCommand` seam `claude-cli.ts` uses, never the SDK/HTTP. These
// tests stub that seam (à la `claudeCliClient` tests in pipeline-llm.test.ts) and
// assert: (1) JSON-out parsing via the shared `extractJson`, (2) pure
// threshold logic, (3) that the CLI invocation actually carries the screenshot
// file paths + rubric context, requests Read-tool access, and forwards
// budget/model.
import { describe, it, expect, vi } from 'vitest';
import {
  scoreScreenshots,
  parseVisionCriticResult,
  meetsQualityBar,
  claudeVisionCritic,
  buildVisionCriticPrompt,
} from '@/pipeline/vision-critic';

function stubRun(resultText: string) {
  return vi.fn(async (_cmd: string, _args: string[], _input?: string) => ({
    stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: resultText }),
    stderr: '',
    code: 0,
  }));
}

describe('parseVisionCriticResult', () => {
  it('parses a clean JSON {score, issues} response', () => {
    expect(parseVisionCriticResult('{"score":4,"issues":["minor padding"]}')).toEqual({
      score: 4,
      issues: ['minor padding'],
    });
  });

  it('extracts JSON out of a fenced/prose response via the shared extractJson helper', () => {
    const text = 'Looking at both screenshots...\n```json\n{"score":2,"issues":["text overlaps hero image","mobile column too narrow"]}\n```';
    expect(parseVisionCriticResult(text)).toEqual({
      score: 2,
      issues: ['text overlaps hero image', 'mobile column too narrow'],
    });
  });

  it('defaults issues to [] when absent', () => {
    expect(parseVisionCriticResult('{"score":5}')).toEqual({ score: 5, issues: [] });
  });

  it('drops non-string entries from issues rather than throwing', () => {
    expect(parseVisionCriticResult('{"score":3,"issues":["ok", 5, null]}')).toEqual({ score: 3, issues: ['ok'] });
  });

  it('throws when score is missing', () => {
    expect(() => parseVisionCriticResult('{"issues":["x"]}')).toThrow();
  });

  it('throws when score is non-numeric', () => {
    expect(() => parseVisionCriticResult('{"score":"good","issues":[]}')).toThrow();
  });
});

describe('meetsQualityBar', () => {
  it('passes at or above the threshold', () => {
    expect(meetsQualityBar({ score: 3, issues: [] }, 3)).toBe(true);
    expect(meetsQualityBar({ score: 4, issues: [] }, 3)).toBe(true);
    expect(meetsQualityBar({ score: 5, issues: [] }, 5)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(meetsQualityBar({ score: 2, issues: ['overlap'] }, 3)).toBe(false);
    expect(meetsQualityBar({ score: 2.9, issues: [] }, 3)).toBe(false);
  });
});

describe('buildVisionCriticPrompt', () => {
  it('includes every screenshot path, the section context, and the JSON-out contract', () => {
    const { prompt, system } = buildVisionCriticPrompt(['/tmp/a-desktop.png', '/tmp/a-mobile.png'], {
      type: 'hero',
      niche: 'saas',
      style: 'minimal',
    });
    expect(prompt).toContain('/tmp/a-desktop.png');
    expect(prompt).toContain('/tmp/a-mobile.png');
    expect(prompt).toContain('hero');
    expect(prompt).toContain('saas');
    expect(prompt).toContain('minimal');
    expect(prompt + system).toMatch(/score/i);
    expect(prompt + system).toMatch(/issues/i);
  });
});

describe('scoreScreenshots (CLI wiring)', () => {
  it('passes screenshot paths + rubric context to the CLI prompt and parses the score', async () => {
    const run = stubRun('{"score":4,"issues":[]}');
    const result = await scoreScreenshots(
      ['/tmp/a-desktop.png', '/tmp/a-mobile.png'],
      { type: 'hero', niche: 'saas', style: 'minimal' },
      { run },
    );
    expect(result).toEqual({ score: 4, issues: [] });
    const [cmd, args, input] = run.mock.calls[0];
    expect(cmd).toBe('claude');
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(input).toContain('/tmp/a-desktop.png');
    expect(input).toContain('/tmp/a-mobile.png');
    expect(input).toContain('hero');
  });

  it('requests Read-tool access so the headless agent can open the screenshots', async () => {
    const run = stubRun('{"score":5,"issues":[]}');
    await scoreScreenshots(['/tmp/x.png'], { type: 'cta', niche: 'agency', style: 'bold' }, { run });
    const [, args] = run.mock.calls[0];
    expect(args).toContain('--allowedTools');
    expect(args.join(' ')).toMatch(/Read/);
  });

  it('passes maxBudgetUsd through to the CLI as --max-budget-usd', async () => {
    const run = stubRun('{"score":5,"issues":[]}');
    await scoreScreenshots(['/tmp/x.png'], { type: 'hero', niche: 'saas', style: 'minimal' }, { run, maxBudgetUsd: 0.25 });
    const [, args] = run.mock.calls[0];
    expect(args).toContain('--max-budget-usd');
    expect(args).toContain('0.25');
  });

  it('passes an optional model override through to the CLI as --model (VISION_CRITIC_MODEL)', async () => {
    const run = stubRun('{"score":5,"issues":[]}');
    await scoreScreenshots(
      ['/tmp/x.png'],
      { type: 'hero', niche: 'saas', style: 'minimal' },
      { run, model: 'claude-haiku-4-5' },
    );
    const [, args] = run.mock.calls[0];
    expect(args).toContain('--model');
    expect(args).toContain('claude-haiku-4-5');
  });

  it('throws when the CLI exits non-zero', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: 'boom', code: 1 }));
    await expect(
      scoreScreenshots(['/tmp/x.png'], { type: 'hero', niche: 'saas', style: 'minimal' }, { run }),
    ).rejects.toThrow();
  });

  it('throws when the CLI response has no parseable score', async () => {
    const run = stubRun('Sorry, I cannot view images.');
    await expect(
      scoreScreenshots(['/tmp/x.png'], { type: 'hero', niche: 'saas', style: 'minimal' }, { run }),
    ).rejects.toThrow();
  });
});

describe('claudeVisionCritic factory', () => {
  it('returns a VisionCritic bound to the given run/model/budget, mirroring claudeCliClient', async () => {
    const run = stubRun('{"score":3,"issues":["cramped mobile column"]}');
    const critic = claudeVisionCritic({ run, model: 'claude-haiku-4-5', maxBudgetUsd: 0.1 });
    const result = await critic(['/tmp/shot.png'], { type: 'pricing', niche: 'fitness', style: 'dark' });
    expect(result).toEqual({ score: 3, issues: ['cramped mobile column'] });
    const [, args] = run.mock.calls[0];
    expect(args).toContain('--model');
    expect(args).toContain('claude-haiku-4-5');
    expect(args).toContain('--max-budget-usd');
    expect(args).toContain('0.1');
  });
});
