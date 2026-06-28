import { describe, it, expect, vi } from 'vitest';
import { parseValidatorOutput, validateLayout } from '@/pipeline/validate';

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
});

describe('validateLayout', () => {
  it('invokes VALIDATOR_CMD with the file and returns the parsed result', async () => {
    const run = vi.fn(async () => ({ stdout: PASS, stderr: '', code: 0 }));
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(true);
    expect(run).toHaveBeenCalledWith('php', ['/v/validate.php', '/tmp/x.json']);
  });
});
