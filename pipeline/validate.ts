// Validator wiring decision (CLAUDE.md §9): OPTION A — CLI.
// We shell out to the validator repo's PHP entry point. Set VALIDATOR_CMD to the
// invocation, e.g.  VALIDATOR_CMD='php "/abs/path/Divi 5 Deterministic Validator/scripts/validate.php"'
// validateLayout appends the file path. Exit 0 = valid, 1 = invalid, 2 = usage.
import { spawn } from 'node:child_process';
import type { RunCommand } from './llm/types';

export interface Violation {
  code: string;
  message: string;
  path: string;
}
export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

const defaultRun: RunCommand = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });

// T2.3 — three-case parse of the validator's stdout, instead of the original
// two-case one (`code===0 && PASS:` → valid; everything else → invalid,
// scan-whatever-you-find). The original collapse silently miscategorized a
// THIRD real shape — exit 0 with no `PASS:` line (or a nonzero exit with no
// parseable `[CODE]` lines) — as "invalid, zero violations", which starves
// the repair loop (nothing to feed it) and eventually drops a layout that
// may have been perfectly fine. `parseValidatorVerdict` makes that third
// shape explicit as `kind: 'unexpected'` so callers can react to it (retry,
// surface as an infra error) instead of ever fabricating a verdict from it.
export type ParsedVerdict =
  | { kind: 'pass' }
  | { kind: 'fail'; violations: Violation[] }
  | { kind: 'unexpected'; reason: string };

function parseViolationLines(stdout: string): Violation[] {
  const violations: Violation[] = [];
  const lines = stdout.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\[([A-Z0-9_]+)\]\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const atLine = lines[i + 1] ?? '';
    const at = /^\s*at:\s*(.*)$/.exec(atLine);
    violations.push({ code: m[1], message: m[2].trim(), path: at ? at[1].trim() : '' });
  }
  return violations;
}

export function parseValidatorVerdict(stdout: string, code: number): ParsedVerdict {
  if (code === 0) {
    if (/^PASS:/m.test(stdout)) return { kind: 'pass' };
    return { kind: 'unexpected', reason: `exit 0 with no PASS: line in output` };
  }

  // Real validate.php (../Divi 5 Deterministic Validator/scripts/validate.php)
  // always pairs a `FAIL:` line with >=1 `[CODE]` line on a nonzero exit — if
  // isValid() were false with zero violations, it wouldn't have printed FAIL:
  // in the first place. So a FAIL: line with zero parseable [CODE] lines is
  // not a legitimate "invalid, no violations" verdict; treat it the same as
  // any other unrecognized shape rather than risk feeding the repair loop an
  // empty violation list (the exact silent-failure pattern this hardens).
  const hasFail = /^FAIL:/m.test(stdout);
  const violations = parseViolationLines(stdout);
  if (hasFail && violations.length > 0) return { kind: 'fail', violations };
  if (hasFail) return { kind: 'unexpected', reason: `FAIL: line present but no parseable [CODE] violation lines (exit ${code})` };
  return { kind: 'unexpected', reason: `exit ${code} with no PASS:/FAIL: line` };
}

// Back-compat two-case wrapper for direct unit tests of the parse boundary.
// NOT used by `validateLayout` (below) — that calls `parseValidatorVerdict`
// directly so it can retry-once/throw on 'unexpected' instead of collapsing
// it into a verdict. Throws on an ambiguous parse rather than fabricating
// `{ valid: false, violations: [] }`.
export function parseValidatorOutput(stdout: string, code: number): ValidationResult {
  const verdict = parseValidatorVerdict(stdout, code);
  if (verdict.kind === 'pass') return { valid: true, violations: [] };
  if (verdict.kind === 'fail') return { valid: false, violations: verdict.violations };
  throw new Error(`validator produced unexpected output: ${verdict.reason}`);
}

// Split a VALIDATOR_CMD string into argv, honoring simple "double quotes".
function splitCmd(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2]);
  return out;
}

export async function validateLayout(
  file: string,
  opts: { run?: RunCommand; validatorCmd?: string } = {},
): Promise<ValidationResult> {
  const run = opts.run ?? defaultRun;
  const cmd = opts.validatorCmd ?? process.env.VALIDATOR_CMD;
  if (!cmd) throw new Error('VALIDATOR_CMD is not set (e.g. `php /path/validate.php`)');
  const parts = splitCmd(cmd);

  const invoke = async (): Promise<ParsedVerdict> => {
    const { stdout, code } = await run(parts[0], [...parts.slice(1), file]);
    return parseValidatorVerdict(stdout, code);
  };

  let verdict = await invoke();
  if (verdict.kind === 'unexpected') {
    // T2.3: a single ambiguous run could be a one-off CLI/subprocess blip
    // (truncated stdout, cold-start noise, a transient PHP warning on
    // stdout). Re-run once before giving up — never fabricate an
    // "invalid, zero violations" verdict from output that matches neither
    // PASS nor FAIL shape (that's the exact bug this task hardens: it burns
    // repair attempts on nothing actionable, then drops a possibly-fine
    // layout).
    verdict = await invoke();
  }

  if (verdict.kind === 'pass') return { valid: true, violations: [] };
  if (verdict.kind === 'fail') return { valid: false, violations: verdict.violations };

  // Still unexpected after one re-run: two independent invocations both
  // failed to produce a PASS/FAIL-shaped verdict, so this reads as a real
  // tooling/infra problem (broken CLI wiring, validator crash, PHP fatal),
  // not a quality verdict. Throw instead of returning a fabricated result —
  // pipeline/run.ts's Phase A is not wrapped in a try/catch around
  // `deps.validate`, so this propagates straight to the per-target outer
  // catch, where T2.2's `classifyError` (pipeline/errors.ts) classifies it
  // (see the 'validator_output' entry there) and `summary.errored` counts
  // it — never `summary.qualityDropped`.
  throw new Error(
    `validator produced unexpected output on both the initial run and the retry ` +
      `(${verdict.reason}) — treating as an infra error, not a quality drop`,
  );
}
