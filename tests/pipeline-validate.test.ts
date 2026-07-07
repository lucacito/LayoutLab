import { describe, it, expect, vi } from 'vitest';
import { parseValidatorOutput, parseValidatorVerdict, validateLayout } from '@/pipeline/validate';
import { classifyError } from '@/pipeline/errors';

const PASS = 'PASS: x.json\n  Layout is valid. No violations found.\n';
const FAIL =
  'FAIL: x.json\n  2 violation(s):\n\n' +
  '  [E_MODULE_UNKNOWN] Unknown module type\n        at: content.0.children.1\n' +
  '  [E_ATTR_MISSING] Missing required attribute\n        at: content.0\n';

describe('parseValidatorOutput', () => {
  it('marks valid on exit 0 / PASS', () => {
    const r = parseValidatorOutput(PASS, 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
  it('parses violation codes/messages/paths on exit 1 / FAIL', () => {
    const r = parseValidatorOutput(FAIL, 1);
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(2);
    expect(r.violations[0]).toEqual({ code: 'E_MODULE_UNKNOWN', message: 'Unknown module type', path: 'content.0.children.1' });
    expect(r.violations[1].code).toBe('E_ATTR_MISSING');
  });

  // T2.3 guard test: this is exactly the silent-failure path the hardening
  // closes. Before T2.3, exit 0 with no `PASS:` line fell through to the
  // violation-line scanner, found nothing, and returned `{ valid: false,
  // violations: [] }` — a fabricated "invalid, zero violations" verdict that
  // starved the repair loop (nothing to fix) and eventually dropped a layout
  // that may have been fine. It must never do that again.
  it('never fabricates a zero-violation invalid verdict for ambiguous exit-0 output', () => {
    expect(() => parseValidatorOutput('Warning: deprecated ini setting\n', 0)).toThrow();
  });
});

describe('parseValidatorVerdict (three-case parse)', () => {
  it('returns kind=pass on exit 0 / PASS', () => {
    expect(parseValidatorVerdict(PASS, 0)).toEqual({ kind: 'pass' });
  });

  it('returns kind=fail with parsed violations on exit 1 / FAIL', () => {
    const v = parseValidatorVerdict(FAIL, 1);
    expect(v.kind).toBe('fail');
    if (v.kind === 'fail') {
      expect(v.violations).toHaveLength(2);
      expect(v.violations[0].code).toBe('E_MODULE_UNKNOWN');
    }
  });

  it('returns kind=unexpected on exit 0 with no PASS: line', () => {
    const v = parseValidatorVerdict('', 0);
    expect(v.kind).toBe('unexpected');
  });

  it('returns kind=unexpected on exit 0 with unrelated stdout noise', () => {
    const v = parseValidatorVerdict('Deprecated: str_contains() ...\n', 0);
    expect(v.kind).toBe('unexpected');
  });

  it('returns kind=unexpected on nonzero exit with no PASS:/FAIL: line', () => {
    const v = parseValidatorVerdict('Fatal error: Uncaught TypeError in Validator.php\n', 1);
    expect(v.kind).toBe('unexpected');
  });

  it('returns kind=unexpected on a FAIL: line with zero parseable [CODE] lines', () => {
    // Defensive case: today's real validator.php always emits >=1 [CODE] line
    // whenever it prints FAIL:, but the parser must not silently collapse a
    // future/aberrant "FAIL with nothing parseable" into invalid-zero-violations
    // either — that is the same silent-failure shape T2.3 closes.
    const v = parseValidatorVerdict('FAIL: x.json\n  0 violation(s):\n\n', 1);
    expect(v.kind).toBe('unexpected');
  });
});

describe('validateLayout', () => {
  it('invokes VALIDATOR_CMD with the file and returns the parsed result', async () => {
    const run = vi.fn(async () => ({ stdout: PASS, stderr: '', code: 0 }));
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(true);
    expect(run).toHaveBeenCalledWith('php', ['/v/validate.php', '/tmp/x.json']);
  });

  it('calls the validator exactly once on a normal PASS (no wasted retry)', async () => {
    const run = vi.fn(async () => ({ stdout: PASS, stderr: '', code: 0 }));
    await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('calls the validator exactly once on a normal FAIL (no wasted retry)', async () => {
    const run = vi.fn(async () => ({ stdout: FAIL, stderr: '', code: 1 }));
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('re-runs once on ambiguous output and recovers if the retry is a clean PASS', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', code: 0 })
      .mockResolvedValueOnce({ stdout: PASS, stderr: '', code: 0 });
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('re-runs once on ambiguous output and recovers if the retry is a clean FAIL', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: 'garbled', stderr: '', code: 0 })
      .mockResolvedValueOnce({ stdout: FAIL, stderr: '', code: 1 });
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  // The core acceptance criterion: exit 0 + no PASS: line, twice in a row,
  // must NEVER resolve to a zero-violation invalid verdict. It must throw so
  // the failure surfaces as an infra error (T2.2's classifyError/run.ts Phase A
  // catch → `summary.errored`), not a quality drop.
  it('throws after two consecutive ambiguous results instead of returning a fabricated verdict', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '', code: 0 }));
    await expect(validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' })).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('the thrown error on persistent ambiguous output classifies as an infra error, not a quality drop', async () => {
    const run = vi.fn(async () => ({ stdout: 'nothing recognizable', stderr: '', code: 0 }));
    let caught: unknown;
    try {
      await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const classified = classifyError(caught);
    // Must not be silently classified as a generic 'unknown' fallthrough that
    // reads the same as an unrelated bug — T2.3 gives it its own code so it's
    // distinguishable in logs/metrics from network/budget/auth/unknown.
    expect(classified.code).toBe('validator_output');
    expect(['transient_infra', 'permanent_infra']).toContain(classified.class);
  });
});
