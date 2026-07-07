// pipeline/vision-critic.ts — T1.3 visual QA gate.
//
// There is no human review (constraint: ingest auto-publishes — see
// lib/ingest/status.ts and CLAUDE.md §Auto-approve), and render only checks
// content-wrapper height, not visual quality. This module IS the QA: it scores
// rendered screenshots against a concrete rubric and hands `pipeline/run.ts` a
// pass/fail signal + human-readable issues before a layout reaches ingest.
//
// CLI-native (constraint #1): scoring goes through the SAME `claude -p` seam
// `pipeline/llm/claude-cli.ts` uses — no Anthropic SDK, no direct HTTP. In
// headless `-p` mode the agent still has file tools, so the prompt hands it the
// screenshots' local FILE PATHS and asks it to Read + judge them, then return
// ONLY `{ score, issues: string[] }`, parsed with the shared `extractJson`
// helper (the same brace-aware, prose-tolerant parser generation/repair use).
import { extractJson, claudeCliClient } from './llm';
import type { LlmClient, RunCommand } from './llm';

export interface VisionCriticContext {
  type: string;
  niche: string;
  style: string;
}

export interface VisionCriticResult {
  score: number;
  issues: string[];
}

/** The shape `RunDeps.visionCritic` expects (pipeline/run.ts) — deliberately a
 * plain function, not a class, so a stub in unit tests is just `vi.fn()`. */
export type VisionCritic = (paths: string[], context: VisionCriticContext) => Promise<VisionCriticResult>;

const SYSTEM_PROMPT =
  'You are a strict visual QA reviewer for a marketplace that sells premium, ' +
  'professionally designed Divi 5 page-section layouts. You are given local ' +
  'screenshot file paths on disk — use the Read tool to open and inspect each ' +
  'one before judging. Respond with ONLY a JSON object of the exact shape ' +
  '{"score": <integer 1-5>, "issues": [<string>, ...]} — no prose, no markdown ' +
  'code fence, nothing before or after the JSON.';

/** Builds the critic's prompt: the rubric (per the T1.3 brief) + the concrete
 * screenshot paths + section context to judge them against. Exported so the
 * exact prompt text is independently testable/reviewable. */
export function buildVisionCriticPrompt(
  paths: string[],
  context: VisionCriticContext,
): { system: string; prompt: string } {
  const list = paths.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const prompt = `Section context: type="${context.type}", niche="${context.niche}", style="${context.style}".

Screenshot files to review (Read each file before scoring):
${list}

Score this render 1-5 on whether it would pass as a premium, PAID layout in a
Divi 5 marketplace. Check specifically for:
- spacing/padding: consistent, no cramped or excessive gaps
- no overlapping text or elements
- no content clipping/overflow (text or images cut off, spilling past their section)
- mobile column widths are sane (not 1-character-wide, not absurdly narrow)
- contrast/legibility: text is readable against its background
- image relevance: images plausibly match the section's stated niche/subject
- overall premium quality: would a paying buyer feel this looks professionally designed?

Scoring guide: 1 = broken/unusable, 3 = passable but flawed, 5 = premium with no
notable issues.

Respond with ONLY JSON: {"score": <1-5 integer>, "issues": ["short specific issue", ...]}.
Use an empty issues array when there are none.`;
  return { system: SYSTEM_PROMPT, prompt };
}

/** Parses the critic's `{score, issues}` JSON out of raw model text, tolerating
 * prose/fences the same way generation output is parsed (via `extractJson`).
 * Throws if there's no usable numeric score — a critic response we can't parse
 * is treated as a failure by the caller, not a silent pass. */
export function parseVisionCriticResult(text: string): VisionCriticResult {
  const parsed = extractJson(text) as { score?: unknown; issues?: unknown };
  const score = Number(parsed?.score);
  if (!Number.isFinite(score)) {
    throw new Error(`vision critic: response missing a numeric "score" (got ${JSON.stringify(parsed?.score)})`);
  }
  const issues = Array.isArray(parsed?.issues) ? parsed.issues.filter((s): s is string => typeof s === 'string') : [];
  return { score, issues };
}

/** Pure threshold check, kept out of pipeline/run.ts so the gate there is a
 * one-line call and this logic is independently unit-testable. */
export function meetsQualityBar(result: VisionCriticResult, minScore: number): boolean {
  return result.score >= minScore;
}

export interface ScoreScreenshotsDeps {
  /** Inject a stub/alternate LlmClient (tests). Defaults to a CLI client built
   * from `run`/`model` below. */
  llm?: LlmClient;
  /** Stub the underlying CLI runner (à la claude-cli.ts's own tests) when `llm`
   * isn't supplied directly. */
  run?: RunCommand;
  /** VISION_CRITIC_MODEL override — a cheaper model than the generator's is
   * usually plenty for a scoring pass. */
  model?: string;
  /** Same `--max-budget-usd` cap every other CLI call respects. */
  maxBudgetUsd?: number;
}

/**
 * Score screenshots against the visual-QA rubric via the `claude` CLI.
 * `paths` must be local file paths the CLI's file tools can Read — NOT blob
 * storage keys/URLs. Requests `Read`-only tool access so the headless call
 * never stalls on an interactive permission prompt (no TTY in a piped pipeline
 * run) and can't do anything beyond reading the images.
 */
export async function scoreScreenshots(
  paths: string[],
  context: VisionCriticContext,
  deps: ScoreScreenshotsDeps = {},
): Promise<VisionCriticResult> {
  const llm = deps.llm ?? claudeCliClient({ run: deps.run, model: deps.model });
  const { system, prompt } = buildVisionCriticPrompt(paths, context);
  const text = await llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd, allowedTools: ['Read'] });
  return parseVisionCriticResult(text);
}

/** Factory mirroring `claudeCliClient(opts)` — binds a CLI client (real or a
 * stubbed `run`) once, so `pipeline/deps.ts` can hand `RunDeps.visionCritic` a
 * plain `VisionCritic` function. */
export function claudeVisionCritic(
  opts: { run?: RunCommand; model?: string; maxBudgetUsd?: number } = {},
): VisionCritic {
  return (paths, context) => scoreScreenshots(paths, context, opts);
}
