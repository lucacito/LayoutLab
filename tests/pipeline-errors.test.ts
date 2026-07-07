// tests/pipeline-errors.test.ts
//
// T2.2: unit tests for the error classifier + retry-with-backoff helper that
// pipeline/run.ts's generic per-target catch now uses to separate infra
// failures (retryable transient vs non-retryable permanent) from quality drops
// (which never reach this module — they're existing `continue`-based gates in
// run.ts, not thrown errors).
import { describe, it, expect, vi } from 'vitest';
import { classifyError, withRetry, isUsageLimitMessage } from '@/pipeline/errors';

describe('classifyError', () => {
  it('classifies a network/connection error as transient_infra', () => {
    const c = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:443'));
    expect(c.class).toBe('transient_infra');
    expect(c.code).toBe('network');
  });

  it('classifies a fetch/socket blip as transient_infra', () => {
    expect(classifyError(new Error('fetch failed')).class).toBe('transient_infra');
    expect(classifyError(new Error('socket hang up')).class).toBe('transient_infra');
    expect(classifyError(new Error('request timed out')).class).toBe('transient_infra');
    expect(classifyError(new Error('upstream returned 503')).class).toBe('transient_infra');
  });

  it('classifies a usage-limit message as permanent_infra with code usage_limit', () => {
    const c = classifyError(new Error('generation blocked by usage limit: hit your limit for this period'));
    expect(c.class).toBe('permanent_infra');
    expect(c.code).toBe('usage_limit');
  });

  it('classifies a budget-exceeded message as permanent_infra with code budget', () => {
    const c = classifyError(new Error('claude CLI exited 1: max budget exceeded'));
    expect(c.class).toBe('permanent_infra');
    expect(c.code).toBe('budget');
  });

  it('classifies an auth/permission error as permanent_infra with code auth', () => {
    const c = classifyError(new Error('401 unauthorized: invalid api key'));
    expect(c.class).toBe('permanent_infra');
    expect(c.code).toBe('auth');
  });

  it('classifies validate.ts\'s persistent-ambiguous-output error as permanent_infra with code validator_output (T2.3)', () => {
    const c = classifyError(
      new Error(
        'validator produced unexpected output on both the initial run and the retry ' +
          '(exit 0 with no PASS: line in output) — treating as an infra error, not a quality drop',
      ),
    );
    expect(c.class).toBe('permanent_infra');
    expect(c.code).toBe('validator_output');
  });

  it('defaults an unrecognized error to permanent_infra with code unknown (safe default: never blindly retry an unknown failure)', () => {
    const c = classifyError(new Error('TypeError: cannot read properties of undefined'));
    expect(c.class).toBe('permanent_infra');
    expect(c.code).toBe('unknown');
  });

  it('handles non-Error thrown values', () => {
    const c = classifyError('a plain string failure');
    expect(c.message).toContain('a plain string failure');
    expect(c.class).toBe('permanent_infra');
  });
});

describe('isUsageLimitMessage', () => {
  it('matches the same patterns generate.ts guards against (single source of truth)', () => {
    expect(isUsageLimitMessage('you have hit your limit for this session')).toBe(true);
    expect(isUsageLimitMessage('usage limit reached')).toBe(true);
    expect(isUsageLimitMessage('rate limit exceeded')).toBe(true);
    expect(isUsageLimitMessage('rate-limited, try later')).toBe(true);
    expect(isUsageLimitMessage('everything is fine')).toBe(false);
  });
});

describe('withRetry', () => {
  it('retries a transient failure the configured number of times then succeeds, using the injected sleep (no real delay)', async () => {
    let calls = 0;
    const sleep = vi.fn(async (_ms: number) => {});
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('ECONNRESET');
      return 'ok';
    });
    const result = await withRetry(fn, { retries: 2, baseDelayMs: 100, sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2);
    // exponential backoff: 100ms, then 200ms
    expect(sleep.mock.calls[0][0]).toBe(100);
    expect(sleep.mock.calls[1][0]).toBe(200);
  });

  it('gives up after exhausting retries and throws the last error, tagged with its classification', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error('ETIMEDOUT');
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 10, sleep })).rejects.toThrow('ETIMEDOUT');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries, then give up
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('never retries a permanent_infra error (e.g. usage-limit) — fails on the first attempt', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error('generation blocked by usage limit: hit your limit');
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 10, sleep })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('never retries an unrecognized (unknown) error either — safe default is no-retry', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error('something bizarre happened');
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 10, sleep })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry with the attempt number and classification before each retry', async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('ECONNRESET');
      return 'ok';
    });
    await withRetry(fn, { retries: 2, baseDelayMs: 10, sleep, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, classified: { class: 'transient_infra', code: 'network' } });
  });

  it('defaults to a real setTimeout-based sleep when none is injected (bounded so the test still runs fast)', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('ECONNRESET');
      return 'ok';
    });
    const result = await withRetry(fn, { retries: 1, baseDelayMs: 1 });
    expect(result).toBe('ok');
  });
});
