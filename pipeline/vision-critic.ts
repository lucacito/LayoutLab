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
// T5.1: the copy-quality check is FOLDED into this same CLI call rather than a
// second `claude -p` round-trip per target — see pipeline/copy-critic.ts's module
// doc for the full rationale. This module only needs its rubric-section builder
// (for the prompt) and its result shape (for the additive JSON contract); the
// text extraction, shingle-overlap boilerplate gate, and flag-threshold policy
// all live over there, independently testable without any CLI/prompt plumbing.
import { buildCopyRubricSection, COPY_JSON_CONTRACT_FIELDS } from './copy-critic';
import type { CopyCriticResult } from './copy-critic';

export interface VisionCriticContext {
  type: string;
  niche: string;
  style: string;
  /** T5.1: the layout's extracted copy (pipeline/copy-critic.ts's
   * `extractLayoutText`), when the caller wants this same call to ALSO rate
   * specificity/tone/repetition. Omit (or pass "") to get the pre-T5.1 visual-
   * only prompt/contract, byte-for-byte — additive, never a required field. */
  text?: string;
}

/** T5.2: `imageRelevanceScore`/`imageIssues` — does each visible photo actually
 * match the section's stated niche/subject (a dental-clinic hero must not show
 * a car)? Additive, like `CopyCriticResult`, but NOT gated behind an optional
 * context field the way copyScore is gated behind `context.text` — the critic
 * already has the rendered screenshots on EVERY call, so the prompt asks for
 * this on every call. Still parsed optionally (present only when the model
 * actually returned it) so an older prompt/response, or a model that ignores
 * the rubric, never breaks existing `{score, issues}` parsing/consumers.
 *
 * Decoupled from the droppable `score` (review fix, post-bd9b2c7): subject/
 * niche mismatch is judged ONLY here, and `buildVisionCriticPrompt` explicitly
 * tells the model this must NOT lower the overall `score` — that field is
 * gated by `meetsQualityBar`/`VISION_CRITIC_MIN_SCORE`, which HARD-DROPS,
 * while `imageRelevanceScore` is gated by `meetsImageRelevanceBar`, which only
 * FLAGS (see pipeline/run.ts). Before this fix the rubric asked the model to
 * factor "image relevance" into the overall score too, so an off-topic image
 * could tank both signals and drop anyway, making the flag-only policy
 * unenforceable outside stubbed tests. The overall score still legitimately
 * drops for a broken/corrupted/garbled image — that's an image-quality defect,
 * not a subject/topic judgment. */
export interface ImageRelevanceCriticResult {
  imageRelevanceScore?: number;
  imageIssues?: string[];
}

/** T5.1: `copyScore`/`copyIssues` are additive (`CopyCriticResult`) — present only
 * when `VisionCriticContext.text` was supplied AND the model returned them.
 * Missing copy fields must never break existing `{score, issues}` consumers. */
export interface VisionCriticResult extends CopyCriticResult, ImageRelevanceCriticResult {
  score: number;
  issues: string[];
}

/** The shape `RunDeps.visionCritic` expects (pipeline/run.ts) — deliberately a
 * plain function, not a class, so a stub in unit tests is just `vi.fn()`. */
export type VisionCritic = (paths: string[], context: VisionCriticContext) => Promise<VisionCriticResult>;

/** T5.2: the additive JSON-contract fragment for `imageRelevanceScore`/
 * `imageIssues` — unlike `COPY_JSON_CONTRACT_FIELDS` (copy-critic.ts), this is
 * part of the BASE contract on every call (see `buildVisionCriticPrompt`), not
 * gated behind an optional context field, so it's defined here rather than in
 * a separate module. */
const IMAGE_RELEVANCE_JSON_CONTRACT_FIELDS = '"imageRelevanceScore": <1-5 integer>, "imageIssues": [<string>, ...]';

const SYSTEM_PROMPT =
  'You are a strict visual QA reviewer for a marketplace that sells premium, ' +
  'professionally designed Divi 5 page-section layouts. You are given local ' +
  'screenshot file paths on disk — use the Read tool to open and inspect each ' +
  'one before judging. Respond with ONLY a JSON object of the exact shape ' +
  '{"score": <integer 1-5>, "issues": [<string>, ...]} — no prose, no markdown ' +
  'code fence, nothing before or after the JSON. T5.2: ALSO separately rate ' +
  'whether every visible photo actually matches the section\'s stated niche/ ' +
  'subject and include "imageRelevanceScore" (integer 1-5) and "imageIssues" ' +
  '([string, ...], naming any off-topic image) in the same JSON object, ' +
  'additively. T5.1: when the prompt also includes a "Section copy" block, ' +
  'ALSO rate that copy per its rubric and include "copyScore" (integer 1-5) ' +
  'and "copyIssues" ([string, ...]) in the same JSON object, additively — the ' +
  'exact contract is restated at the end of the prompt.';

/** Builds the critic's prompt: the rubric (per the T1.3 brief) + the concrete
 * screenshot paths + section context to judge them against. Exported so the
 * exact prompt text is independently testable/reviewable. */
export function buildVisionCriticPrompt(
  paths: string[],
  context: VisionCriticContext,
): { system: string; prompt: string } {
  const list = paths.map((p, i) => `${i + 1}. ${p}`).join('\n');
  // T5.1: additive — an absent/empty `context.text` produces the EXACT pre-T5.1
  // prompt/contract (byte-for-byte), so a caller that never extracts copy (or a
  // layout with no extractable prose) sees no behavior change whatsoever.
  const hasCopy = !!context.text && context.text.trim().length > 0;
  const copySection = hasCopy ? buildCopyRubricSection(context.text as string) : '';
  // T5.2: image relevance is asked for on EVERY call (unlike the copy fields,
  // which are gated behind `context.text` being supplied) — the critic already
  // has the rendered screenshots regardless of whether copy text was extracted,
  // so there's nothing to gate this additive field on.
  const baseFields = `"score": <1-5 integer>, "issues": ["short specific issue", ...], ${IMAGE_RELEVANCE_JSON_CONTRACT_FIELDS}`;
  const jsonContract = hasCopy ? `{${baseFields}, ${COPY_JSON_CONTRACT_FIELDS}}` : `{${baseFields}}`;
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
- image quality: images are not broken, corrupted, blurry, or garbled (do NOT
  judge whether an image's SUBJECT matches the niche here — that is rated
  separately below in imageRelevanceScore and must NOT affect this score)
- overall premium quality: would a paying buyer feel this looks professionally designed?

Scoring guide: 1 = broken/unusable, 3 = passable but flawed, 5 = premium with no
notable issues.

Additionally, rate IMAGE RELEVANCE separately from the score above: for each
visible photo in the screenshots, does it plausibly match the section's stated
niche/subject (e.g. a dental clinic hero must not show a car; a restaurant
gallery must not show an office)? Include this as "imageRelevanceScore" (1-5
integer, 5 = every image matches, 1 = clearly off-topic) with "imageIssues"
(short strings naming any off-topic image, e.g. "hero photo shows a car, not a
dental clinic"). Use an empty issues array and score 5 when every image
matches. A subject/topic mismatch must NOT lower the overall score above — rate
it ONLY here in imageRelevanceScore. The overall score keeps judging
visual/layout quality (spacing, overlap, clipping, contrast, mobile sanity,
premium feel); a broken, corrupted, or otherwise genuinely bad-looking image
still legitimately lowers the overall score, but an on-topic subject is not
what the overall score is for.${copySection}

Respond with ONLY JSON: ${jsonContract}.
Use an empty issues array when there are none.`;
  return { system: SYSTEM_PROMPT, prompt };
}

/** Parses the critic's `{score, issues}` JSON out of raw model text, tolerating
 * prose/fences the same way generation output is parsed (via `extractJson`).
 * Throws if there's no usable numeric score — a critic response we can't parse
 * is treated as a failure by the caller, not a silent pass. */
export function parseVisionCriticResult(text: string): VisionCriticResult {
  const parsed = extractJson(text) as {
    score?: unknown;
    issues?: unknown;
    copyScore?: unknown;
    copyIssues?: unknown;
    imageRelevanceScore?: unknown;
    imageIssues?: unknown;
  };
  const score = Number(parsed?.score);
  if (!Number.isFinite(score)) {
    throw new Error(`vision critic: response missing a numeric "score" (got ${JSON.stringify(parsed?.score)})`);
  }
  const issues = Array.isArray(parsed?.issues) ? parsed.issues.filter((s): s is string => typeof s === 'string') : [];
  const result: VisionCriticResult = { score, issues };
  // T5.1: additive fields — only set when present AND well-formed, so a response
  // that never mentions them (older prompt, or a model that ignored the copy
  // rubric) parses to exactly the pre-T5.1 `{score, issues}` shape, no `undefined`-
  // valued keys tacked on.
  const copyScore = Number(parsed?.copyScore);
  if (parsed?.copyScore !== undefined && Number.isFinite(copyScore)) {
    result.copyScore = copyScore;
  }
  if (Array.isArray(parsed?.copyIssues)) {
    result.copyIssues = parsed.copyIssues.filter((s): s is string => typeof s === 'string');
  }
  // T5.2: same additive-parsing treatment as copyScore/copyIssues above — only
  // set when present AND well-formed, so a response that never mentions image
  // relevance (older prompt, or a model that ignored the rubric) parses to
  // exactly the pre-T5.2 shape, no `undefined`-valued keys tacked on.
  const imageRelevanceScore = Number(parsed?.imageRelevanceScore);
  if (parsed?.imageRelevanceScore !== undefined && Number.isFinite(imageRelevanceScore)) {
    result.imageRelevanceScore = imageRelevanceScore;
  }
  if (Array.isArray(parsed?.imageIssues)) {
    result.imageIssues = parsed.imageIssues.filter((s): s is string => typeof s === 'string');
  }
  return result;
}

/** Pure threshold check, kept out of pipeline/run.ts so the gate there is a
 * one-line call and this logic is independently unit-testable. */
export function meetsQualityBar(result: VisionCriticResult, minScore: number): boolean {
  return result.score >= minScore;
}

/**
 * T5.2: mirrors copy-critic.ts's `meetsCopyBar` — a DISTINCT function (not a
 * shared generic) since a `false` here carries FLAG, not DROP, policy weight
 * (see pipeline/run.ts's `image_relevance` RunEvent). `imageRelevanceScore ===
 * undefined` (the model didn't return the additive field) is treated as
 * passing: no signal is not a bad signal.
 */
export function meetsImageRelevanceBar(imageRelevanceScore: number | undefined, minScore: number): boolean {
  if (imageRelevanceScore === undefined) return true;
  return imageRelevanceScore >= minScore;
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
