import { spawn } from 'node:child_process';
import type { LlmClient, RunCommand } from './types';
import { LlmError } from './types';
import { parseClaudeEnvelope, parseClaudeUsage } from './parse';

const defaultRun: RunCommand = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });

export function claudeCliClient(opts: { run?: RunCommand; model?: string } = {}): LlmClient {
  const run = opts.run ?? defaultRun;
  return {
    async complete({ prompt, system, maxBudgetUsd, onUsage, allowedTools }) {
      const args = ['-p', '--output-format', 'json'];
      if (maxBudgetUsd != null) args.push('--max-budget-usd', String(maxBudgetUsd));
      if (system) args.push('--append-system-prompt', system);
      if (opts.model) args.push('--model', opts.model);
      // T1.3 vision critic: pre-approve specific tools (e.g. Read) for this call so
      // the headless agent can open screenshot files without an interactive
      // permission prompt it has no TTY to answer. Additive — omitted by every
      // other existing caller, so their invocation is byte-for-byte unchanged.
      if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(','));
      const { stdout, stderr, code } = await run('claude', args, prompt);
      // On failure the CLI often reports the reason on stdout (e.g. usage-limit
      // messages with --output-format json), not stderr — surface whichever has it.
      if (code !== 0) throw new LlmError(`claude CLI exited ${code}: ${(stderr.trim() || stdout).slice(0, 200)}`);
      if (onUsage) onUsage(parseClaudeUsage(stdout));
      return parseClaudeEnvelope(stdout);
    },
  };
}
