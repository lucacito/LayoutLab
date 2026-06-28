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

export function parseValidatorOutput(stdout: string, code: number): ValidationResult {
  if (code === 0 && /^PASS:/m.test(stdout)) return { valid: true, violations: [] };

  const violations: Violation[] = [];
  const lines = stdout.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\[([A-Z0-9_]+)\]\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const atLine = lines[i + 1] ?? '';
    const at = /^\s*at:\s*(.*)$/.exec(atLine);
    violations.push({ code: m[1], message: m[2].trim(), path: at ? at[1].trim() : '' });
  }
  return { valid: false, violations };
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
  const { stdout, code } = await run(parts[0], [...parts.slice(1), file]);
  return parseValidatorOutput(stdout, code);
}
