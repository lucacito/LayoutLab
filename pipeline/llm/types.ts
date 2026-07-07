/** Cost/token accounting for one `complete()` call. All fields optional — a
 * client that can't report usage just omits them (stub clients in tests never
 * call `onUsage`, so callers must treat every field as possibly absent). */
export interface LlmUsage {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmClient {
  complete(input: {
    prompt: string;
    system?: string;
    maxBudgetUsd?: number;
    /** Additive instrumentation hook (T4.1 eval harness) — report cost/token
     * usage for this call, if the client can. Never required, never blocking. */
    onUsage?: (usage: LlmUsage) => void;
    /** Additive (T1.3 vision critic) — pre-approve specific tool names for this
     * headless `-p` call (e.g. `["Read"]`) so the CLI agent can open local
     * screenshot files without stalling on an interactive permission prompt that
     * has no TTY to answer it (a piped, non-interactive pipeline run). Every
     * other existing caller omits this and gets today's behavior unchanged. */
    allowedTools?: string[];
  }): Promise<string>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export type RunCommand = (
  cmd: string,
  args: string[],
  input?: string,
) => Promise<{ stdout: string; stderr: string; code: number }>;
