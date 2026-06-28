export interface LlmClient {
  complete(input: { prompt: string; system?: string; maxBudgetUsd?: number }): Promise<string>;
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
