// pipeline/run.ts
import { rm } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import type { LlmClient, LlmUsage } from './llm';
import type { Target, Guide } from './recipes';
import { buildRepairPrompt, buildContentRepairPrompt } from './recipes';
import { extractJson } from './llm';
import { generateLayout } from './generate';
import { composeLanding } from '@/pipeline/compose';
import type { Brief, Step } from '@/pipeline/compose';
import { generateSeo } from './seo';
import type { LayoutSeo } from './seo';
import { contentHash, nearestDistance, perceptualDupeMaxDistance } from './dedupe';
import { stackLayoutJsonMobile } from './stack-mobile';
import { lintLayoutJson } from './content-lint';
import type { ValidationResult } from './validate';
import type { UploadResult } from './upload';
import type { IngestPayload } from '@/lib/ingest/schema';
import { meetsQualityBar, meetsImageRelevanceBar } from './vision-critic';
import type { VisionCriticContext, VisionCriticResult } from './vision-critic';
// T5.1: copy-quality gate — extractLayoutText feeds the folded vision-critic
// prompt (see vision-critic.ts); isCopyBoilerplate/copyBoilerplateMaxOverlap are
// the deterministic cross-layout-duplication DROP gate; meetsCopyBar is the
// LLM-copyScore FLAG-only threshold (never drops by itself — see pipeline/
// copy-critic.ts's module doc for the full flag-vs-drop policy rationale).
import { extractLayoutText, isCopyBoilerplate, copyBoilerplateMaxOverlap, meetsCopyBar } from './copy-critic';
// T2.2: classify errors caught by the per-target catch below into 'transient_infra'
// (retried with backoff) vs 'permanent_infra' (usage-limit/budget/auth/unknown —
// never retried). See pipeline/errors.ts's module doc for why 'quality' drops
// (validator/lint/near-dupe/vision-critic) have no representation there — they
// never throw, so they never reach this classifier.
import { classifyError, withRetry } from './errors';

/** Card slugs must be unique across the 18-variant matrix, but the AI-written base
 * slug collides between near-identical variants (all "feature cards"). Append the
 * variant for cards so every combo gets a distinct, descriptive, collision-free slug. */
export function variantSlug(baseSlug: string, target: Target): string {
  const v = target.variant;
  if (!v || target.type !== 'cards') return baseSlug;
  return `${baseSlug}-${v.columns}col-${v.icons}-${v.iconStyle}`;
}

export interface RunSummary {
  generated: number;
  repaired: number;
  /** T2.2: renamed from `dropped` — a QUALITY gate rejected this target
   * (structural validation, content lint, vision-critic score/error, or the
   * near-dupe/render-miss gates via their own dedicated counters below). Never
   * incremented for an infra failure anymore — see `errored`. */
  qualityDropped: number;
  /** T2.2: this target's per-target processing THREW and was not (or was no
   * longer) retryable — either a `permanent_infra` error (usage-limit, budget,
   * auth, or an unrecognized error — see pipeline/errors.ts's safe default) on
   * the first attempt, or a `transient_infra` error that exhausted its retry
   * budget. Distinct from `qualityDropped`: this says nothing about the
   * generated layout's quality — the target was never fully evaluated. */
  errored: number;
  deduped: number;
  ingested: number;
  /** Dropped for being within `PERCEPTUAL_DUPE_MAX_DISTANCE` of another hash —
   * either one already in the DB or one accepted earlier in this same run
   * (T1.2). Distinct from `deduped` (exact content-hash match). */
  nearDuped: number;
  /** T1.3: a renderer WAS wired (a real, non-dry-run pipeline call) but produced
   * no real previews for this target — closes the swallowed-render hole where a
   * layout carrying only placeholder previews would otherwise sail through to
   * ingest. Distinct from `qualityDropped` (validation/content/vision-critic
   * drops) and a no-op when `deps.render` is absent entirely (dry-run/unit
   * tests) — see the render-miss gate in `runPipeline` for the exact condition.
   * T2.1: now specifically the "generic no-previews/infra" bucket — a render
   * exception, or a resolved render with empty previews and no explicit
   * `outcome`. A confirmed-blank page is counted under `renderBlank` instead. */
  renderFailed: number;
  /** T2.1: the renderer resolved WITHOUT throwing but reported an explicit
   * `outcome: 'blank'` verdict — the page never confirmably painted content
   * (pipeline/render.ts's reload loop never crossed its height threshold).
   * Distinct from `renderFailed` (exception, or no-previews with no verdict at
   * all): a blank render is a confirmed "nothing to sell" signal, not a
   * transient infra failure. Never ingested either way. */
  renderBlank: number;
}

/** Terminal fate of one target — reported on the paired `llm_usage` event so a
 * consumer can attribute cost/tokens to "accepted" without depending on event
 * ordering. T2.2: `errored` covers both permanent-infra and retry-exhausted
 * transient-infra failures — see `RunSummary.errored`. */
export type RunOutcome =
  | 'ingested'
  | 'dropped'
  | 'deduped'
  | 'near_duplicate'
  | 'render_failed'
  | 'render_blank'
  | 'errored';

/**
 * Additive instrumentation feed (T4.1 eval harness) alongside `RunSummary`.
 * `RunSummary` stays the pipeline's small, stable counter contract; `RunEvent`
 * is the richer per-target detail feed the eval harness aggregates into a
 * scoreboard. Consuming it is entirely optional — omitting `RunDeps.onEvent`
 * changes no pipeline behavior (a throwing consumer is caught and logged, never
 * propagated — see `emit` in `runPipeline` below, a T2.2 review fix). New
 * quality gates (T1.2 near-dupe, T1.3 vision critic, T2.2 error classes) should
 * add a new event variant here rather than grow RunSummary or reshape this
 * union.
 */
export type RunEvent =
  | { type: 'generated'; target: Target }
  | { type: 'repair_attempt'; target: Target; kind: 'structural' | 'content' }
  | { type: 'content_lint'; target: Target; hit: boolean; codes: string[] }
  /** T5.2: a `PLACEHOLDER_IMAGE` content-lint violation survived the repair
   * loop (pipeline/content-lint.ts's rule of the same name — an unresolved
   * loremflickr/placehold.co/etc. host) — this is the "Pexels swap missed"
   * signal: deliberately never a drop reason (see the `warn(content)` log line
   * this rides alongside in `runPhaseA` below), but visible in the eval
   * scoreboard (pipeline/eval/metrics.ts) as a placeholder-miss rate so it's
   * clear how often the image-resolution step fails to find a real photo. */
  | { type: 'placeholder_image_miss'; target: Target }
  | {
      type: 'dropped';
      target: Target;
      /** T2.2: `reason: 'error'` no longer exists — a thrown error is now an
       * `errored` event (see below), never a `dropped` one. `vision_critic` =
       * scored below threshold; `vision_critic_error` = the critic itself
       * threw/returned unparseable JSON — both are deliberate QUALITY drops
       * (no unscored layout ships is a content-quality policy, not an infra
       * signal), kept distinct from each other so the eval scoreboard can tell
       * them apart. T5.1 adds `'copy_boilerplate'` — the DETERMINISTIC shingle-
       * overlap cross-layout-duplication gate (pipeline/copy-critic.ts's
       * `isCopyBoilerplate`); deliberately NOT `'vision_critic'`/reused from the
       * LLM copyScore — that score is a FLAG-only signal (see the `copy_critic`
       * event below) and never drops a target by itself.
       *
       * T2.2 review fix: this variant's `type` stays `'dropped'` (NOT renamed
       * to `'qualityDropped'` to mirror the `RunSummary` field of the same
       * name) — every one of these reasons is exactly the "a quality gate
       * rejected this target" signal `summary.qualityDropped` counts, so the
       * event and the counter are deliberately compatible in MEANING even
       * though their names diverge; renaming the event type would be a
       * needless breaking change for the eval harness (and any other
       * consumer) that already keys off `event.type === 'dropped'`. */
      reason: 'validation' | 'content' | 'vision_critic' | 'vision_critic_error' | 'copy_boilerplate';
      detail: string;
    }
  | { type: 'deduped'; target: Target }
  /** Perceptual-hash near-duplicate drop (T1.2) — see `RunSummary.nearDuped`. */
  | { type: 'near_duplicate'; target: Target; distance: number }
  /** Render-miss drop (T1.3) — see `RunSummary.renderFailed`. T2.1: `detail`
   * carries the thrown error's message when the render step itself threw (a
   * Minor from T1.3's review) — undefined for the legacy resolved-empty case. */
  | { type: 'render_failed'; target: Target; detail?: string }
  /** Confirmed-blank render drop (T2.1) — see `RunSummary.renderBlank`. */
  | { type: 'render_blank'; target: Target }
  /** Vision-critic score for this target (T1.3), emitted whether it passed or
   * dropped — the eval harness (T4.1) aggregates these into a score distribution. */
  | { type: 'vision_critic'; target: Target; score: number; issues: string[]; passed: boolean }
  /** T5.1: the LLM copyScore from the SAME folded critic call (pipeline/
   * copy-critic.ts) — emitted alongside `vision_critic` whenever the model
   * returned a `copyScore`, whether or not it met `COPY_CRITIC_MIN_SCORE`.
   * `passed: false` is a FLAG, not a drop — the target still proceeds to
   * ingest; see `meetsCopyBar`'s module doc for why. Absent entirely when the
   * model didn't return a `copyScore` (nothing to report). */
  | { type: 'copy_critic'; target: Target; copyScore: number; copyIssues: string[]; passed: boolean }
  /** T5.2: the LLM imageRelevanceScore from the SAME folded critic call
   * (pipeline/vision-critic.ts) — emitted alongside `vision_critic`/`copy_critic`
   * whenever the model returned an `imageRelevanceScore`, whether or not it met
   * `IMAGE_RELEVANCE_MIN_SCORE`. `passed: false` is a FLAG, not a drop — the
   * target still proceeds to ingest; controller resolution (see
   * pipeline/vision-critic.ts's `meetsImageRelevanceBar` doc) deliberately
   * rejected a re-resolve-and-rescore loop as a follow-up, not this task, since
   * render+critic are both memoized per target (see `criticMemo`/`renderMemo`
   * below) and a second pass would re-render and re-score — expensive and
   * complex for a first cut. Absent entirely when the model didn't return an
   * `imageRelevanceScore` (nothing to report). */
  | { type: 'image_relevance'; target: Target; imageRelevanceScore: number; imageIssues: string[]; passed: boolean }
  | { type: 'ingested'; target: Target; slug: string }
  /** T2.2: emitted once per retry attempt on a `transient_infra` failure,
   * BEFORE the backoff sleep — lets a consumer count/observe retries without
   * instrumenting `withRetry` itself. */
  | { type: 'retry'; target: Target; attempt: number; code: string; detail: string }
  /** T2.4: the SEO step's metaDescription/keyword count still missed the
   * minimum quality floor (pipeline/seo.ts's `seoMinMetaDescriptionLength`/
   * `seoMinKeywords`) even after its one allowed retry. Deliberately NOT a
   * drop gate — the brief calls for "logged/flagged", so the target still
   * proceeds to ingest with whatever metadata the model produced; this event
   * exists purely so the eval scoreboard can count how often that happens. */
  | { type: 'seo_floor_miss'; target: Target; metaDescriptionLength: number; keywordCount: number }
  /** T2.4: pipeline/seo.ts's `clampOne`/`clampMany` silently reverted an
   * off-enum (or, for colors, partially off-enum) axis value the model
   * proposed — a useful QA signal: the model disagreeing with the assigned
   * taxonomy often means the render doesn't match the target. */
  | { type: 'seo_clamped'; target: Target; axis: 'type' | 'niche' | 'style' | 'colors'; proposed: unknown; clamped: string | string[] }
  /** T2.2: terminal state for a target whose per-target processing threw and
   * was not (or was no longer) retryable — see `RunSummary.errored`. `class`
   * and `code` come straight from `pipeline/errors.ts`'s `classifyError`;
   * `attempts` is the total number of tries this target got (1 = failed on the
   * first try, either `permanent_infra` or retries disabled). */
  | { type: 'errored'; target: Target; class: 'transient_infra' | 'permanent_infra'; code: string; detail: string; attempts: number }
  | { type: 'llm_usage'; target: Target; usage: Required<LlmUsage>; outcome: RunOutcome };

export interface RunDeps {
  targets: Target[];
  guide: Guide;
  llm: LlmClient;
  validate: (json: string) => Promise<ValidationResult>;
  /** Swap keyword placeholder image URLs for real stock photos (e.g. Pexels). */
  resolveImages?: (json: string) => Promise<string>;
  isDuplicate: (hash: string) => Promise<boolean>;
  upload: (hash: string, json: string) => Promise<UploadResult>;
  /** Render the section to real screenshots; returns preview keys + a perceptual
   * hash. `previewImageKeys: []` signals a render miss (T1.3) — the caller
   * drops the layout rather than ingesting one with only placeholder previews.
   * `screenshotPaths` (T1.3), when provided, are LOCAL file paths to the same
   * shots for the vision critic to Read — distinct from `previewImageKeys`,
   * which are blob storage keys the critic (a CLI file-reading agent) can't open.
   * T2.1: `outcome` distinguishes a confirmed-blank page (`'blank'`) from a
   * healthy one (`'ok'`) on a RESOLVED call — optional for backward
   * compatibility; a resolved call with empty `previewImageKeys` and no
   * `outcome` falls into the legacy generic render-miss bucket (`renderFailed`).
   * `error`, when present, is the message from a render exception that a
   * production wrapper (pipeline/deps.ts's `renderAndCapture`) swallowed into a
   * resolved result instead of letting it throw — surfaced on the
   * `render_failed` RunEvent's `detail` field. A THROWN rejection (as opposed to
   * a resolved `error` field) is still supported directly — see the try/catch
   * around this call below — and is exactly equivalent to it. */
  render?: (input: { title: string; postContent: string; hash: string }) => Promise<{
    previewImageKeys: string[];
    perceptualHash?: string;
    screenshotPaths?: string[];
    outcome?: 'ok' | 'blank';
    error?: string;
  }>;
  /** Existing perceptual hashes to compare against for near-duplicate detection
   * (T1.2) — e.g. every non-null `perceptual_hash` row in the DB. Fetched ONCE
   * per `runPipeline` call (not per target) and then grown in-memory with every
   * hash this run itself accepts, so a `vary` batch minting several
   * near-identical layouts drops the later ones even before any of them is
   * ingested. Omitting this dep means the gate only sees hashes accepted
   * earlier in the same run — it never throws or blocks ingest for its absence. */
  nearDuplicateHashes?: () => Promise<string[]>;
  /** T1.3 visual QA gate — optional/injected exactly like `render`/`resolveImages`:
   * absent means the gate is skipped entirely (unit tests, dry-runs). Scores the
   * real screenshots (via the `claude` CLI — see pipeline/vision-critic.ts) and
   * returns `{ score, issues }`; below `visionCriticMinScore` the target is
   * dropped before ingest. Only invoked after render actually produced real
   * previews — there's nothing meaningful to critique otherwise. */
  visionCritic?: (paths: string[], context: VisionCriticContext) => Promise<VisionCriticResult>;
  /** VISION_CRITIC_MIN_SCORE — minimum acceptable score (default 3, resolved by
   * pipeline/deps.ts from the env var of the same name). */
  visionCriticMinScore?: number;
  /** T5.1: COPY_CRITIC_MIN_SCORE — minimum acceptable LLM copyScore (default 3,
   * mirrors `visionCriticMinScore`'s resolution) before the `copy_critic` event
   * is emitted with `passed: false`. FLAG-only: unlike `visionCriticMinScore`,
   * failing this bar never drops the target — see `meetsCopyBar`. */
  copyCriticMinScore?: number;
  /** T5.2: IMAGE_RELEVANCE_MIN_SCORE — minimum acceptable LLM
   * imageRelevanceScore (default 3, mirrors `copyCriticMinScore`'s resolution)
   * before the `image_relevance` RunEvent is emitted with `passed: false`.
   * FLAG-only, same policy as `copyCriticMinScore`: failing this bar never
   * drops the target — see `meetsImageRelevanceBar`. */
  imageRelevanceMinScore?: number;
  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;
  maxRepairs: number;
  maxParseRetries?: number;
  maxBudgetUsd?: number;
  log?: (msg: string) => void;
  /** Additive instrumentation hook (T4.1) — see `RunEvent`. */
  onEvent?: (event: RunEvent) => void;
  /** T2.2: max number of RETRIES (not counting the first attempt) for a
   * `transient_infra` failure at the per-target level. Default 2 (so up to 3
   * total tries). A `permanent_infra` error is never retried regardless of
   * this value. */
  maxRetries?: number;
  /** T2.2: base delay for exponential backoff between retries (doubled each
   * attempt: attempt 1 waits this long, attempt 2 waits 2x, ...). Default 250ms. */
  retryBaseDelayMs?: number;
  /** T2.2: injectable so tests run instantly — defaults to a real
   * `setTimeout`-based delay in production (see pipeline/errors.ts's `withRetry`). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * T4.2: one work item for the shared per-layout orchestrator (`processItem`).
 * Both entry paths build these and hand them to the SAME gate pipeline:
 *  - the matrix/vary path (`runPipeline`) builds a bare `{ target }` — no pins,
 *    so slug/title/axes all come from the SEO step and `composeExtras` is absent
 *    (a `full_landing` matrix target composes its own brief);
 *  - the theme path (`runThemePack` in pipeline/theme.ts) builds an item whose
 *    `composeExtras` PINS the shared brief/brandFacts/flow (cohesion across the
 *    pack's pages) and whose `pins` fix the deterministic brand+role slug/title
 *    and the axes (`full_landing`, the pack's niche/style) so SEO can't drift
 *    them per page.
 * This is the seam that replaces theme.ts's former copy of the gate sequence —
 * every gate added to `processItem` (render/near-dupe/vision-critic/SEO-floor/
 * error classes) now applies to both paths automatically.
 */
export interface PipelineItem {
  target: Target;
  /** Theme-only: pinned compose options merged into `ComposeDeps` for a
   * `full_landing` target. Absent for the matrix path (its `full_landing`
   * targets generate their own brief). */
  composeExtras?: { brief?: Brief; brandFacts?: string; flow?: Step[] };
  /** Theme-only: fixed ingest slug/title/axes (deterministic brand+role, pinned
   * niche/style) so the SEO step doesn't rename pages of a coherent pack. Absent
   * for the matrix path, where these come from the SEO result + `variantSlug`. */
  pins?: {
    slug: string;
    title: string;
    type: string;
    niche: string;
    style: string;
    /** Preferred color to lead the ingest `colors` array. */
    color?: string;
  };
}

/** Assemble the ingest payload from Phase A's SEO result + Phase B's blob/render
 * outputs, applying an item's pins when present (theme) or falling back to the
 * matrix defaults (`variantSlug` + the SEO-inferred axes). Extracted so both
 * paths build byte-identical payloads through ONE code path. */
function buildIngestPayload(
  item: PipelineItem,
  seo: LayoutSeo,
  parts: { diviJsonBlobKey: string; previewImageKeys: string[]; hash: string; perceptualHash?: string },
): IngestPayload {
  const { target, pins } = item;
  const type = pins?.type ?? seo.axes.type;
  const niche = pins?.niche ?? seo.axes.niche;
  const style = pins?.style ?? seo.axes.style;
  const leadColor = pins?.color ?? target.color;
  const colors = leadColor ? [leadColor, ...seo.axes.colors.filter((c) => c !== leadColor)] : seo.axes.colors;
  return {
    slug: pins?.slug ?? variantSlug(seo.slug, target),
    title: pins?.title ?? seo.title,
    description: seo.metaDescription,
    type,
    niche,
    style,
    colors,
    diviJsonBlobKey: parts.diviJsonBlobKey,
    previewImageKeys: parts.previewImageKeys,
    contentHash: parts.hash,
    perceptualHash: parts.perceptualHash,
    variant: target.variant,
    validatorPassed: true,
    seo: { metaTitle: seo.title, metaDescription: seo.metaDescription, keywords: seo.keywords },
    tags: [
      { axis: 'type', slug: type },
      { axis: 'niche', slug: niche },
      { axis: 'style', slug: style },
    ],
  };
}

/** Shared, run-scoped state threaded through every `processItem` call: the deps,
 * the growing `RunSummary`, the near-dupe pool (seeded once from the DB), and the
 * resolved retry/near-dupe knobs. Built by `createRunContext`. */
export interface RunContext {
  deps: RunDeps;
  summary: RunSummary;
  /** Near-duplicate pool (T1.2). Seeded once from `deps.nearDuplicateHashes`,
   * then grown with each accepted hash — but ONLY when `growDedupePools` is
   * true. Theme runs set it false so sibling pages of ONE pack (intentionally
   * same-palette, shared header/footer bands) are never near-dupe-dropped
   * against each other (T4.2 adjudication) — they're still checked against the
   * seeded cross-pack pool, just never poison it for each other.
   *
   * Review fix (T5.1 review): the flag is named `growDedupePools` (was
   * `growNearDupPool`) because it is deliberately scope-neutral — ONE flag
   * gates BOTH this pool and `copyTextPool` below. The old name only described
   * this pool and silently hid that coupling. See `copyTextPool`'s doc for the
   * other half of the same story. */
  nearDupPool: string[];
  /** T5.1: in-run-only pool of extracted layout text this run has ACCEPTED so
   * far — the deterministic cross-layout-boilerplate gate's comparison set. See
   * pipeline/copy-critic.ts's module doc for why there's no DB-seeded
   * counterpart (unlike `nearDupPool`/`nearDuplicateHashes`) yet.
   *
   * Review fix (T5.1 review): grown/checked under the SAME `growDedupePools`
   * flag as `nearDupPool` above, not a separate flag — a theme run
   * (`growDedupePools: false`) skips BOTH pools together, for the identical
   * reason: sibling pages of ONE theme pack intentionally share both visuals
   * AND brand copy (footer/contact text, CTA phrasing), so neither pool may
   * check-or-grow against a theme pack's own sibling pages. */
  copyTextPool: string[];
  maxDistance: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  /** One flag, two pools (see both pools' docs above, and copy-critic.ts's
   * module doc): `true` (matrix/vary default) grows and checks against BOTH
   * `nearDupPool` (pixel near-dupe, T1.2) and `copyTextPool` (text boilerplate,
   * T5.1); `false` (theme runs) disables both together, since a theme pack's
   * sibling pages intentionally repeat both visuals and brand copy on purpose.
   * Named `growDedupePools`, not `growNearDupPool` (review fix, T5.1 review) —
   * the old name only described the near-dupe half of what it controls. */
  growDedupePools: boolean;
  log: (msg: string) => void;
  onEvent: (event: RunEvent) => void;
}

export function newRunSummary(): RunSummary {
  return {
    generated: 0,
    repaired: 0,
    qualityDropped: 0,
    errored: 0,
    deduped: 0,
    ingested: 0,
    nearDuped: 0,
    renderFailed: 0,
    renderBlank: 0,
  };
}

/** Build the shared run context: seed the near-dupe pool once (not per item) and
 * resolve the retry/near-dupe knobs. `growDedupePools` defaults true (matrix); the
 * theme path passes false (see `RunContext.nearDupPool`/`RunContext.copyTextPool`). */
export async function createRunContext(deps: RunDeps, opts?: { growDedupePools?: boolean }): Promise<RunContext> {
  return {
    deps,
    summary: newRunSummary(),
    nearDupPool: deps.nearDuplicateHashes ? await deps.nearDuplicateHashes() : [],
    // T5.1: no DB-seeded source (see the module doc on `RunContext.copyTextPool`)
    // — starts empty every run, grown only from what THIS run itself accepts.
    copyTextPool: [],
    maxDistance: perceptualDupeMaxDistance(),
    maxRetries: deps.maxRetries ?? 2,
    retryBaseDelayMs: deps.retryBaseDelayMs ?? 250,
    growDedupePools: opts?.growDedupePools ?? true,
    log: deps.log ?? (() => {}),
    onEvent: deps.onEvent ?? (() => {}),
  };
}

/** Terminal result of processing one item through the shared gate pipeline.
 * `abort` propagates a usage-limit/auth run-abort up to the caller's loop;
 * `slug` is the item's ingest slug (always the pinned one for themes, so the
 * theme wrapper can record it in the pack even on a dedupe/skip outcome). */
export interface ItemResult {
  outcome: RunOutcome;
  slug?: string;
  abort: boolean;
}

/**
 * T2.2 review fix — retry-boundary redesign.
 *
 * The original T2.2 cut wrapped the ENTIRE per-target body in `withRetry`,
 * which broke constraint #7 (never double-charge LLM calls already done) two
 * ways a reviewer's probe confirmed:
 *   1. Post-ingest bookkeeping (nearDupPool push, `summary.ingested++`, log,
 *      the `'ingested'` event) ran INSIDE the retry boundary, so a throwing
 *      event consumer (or any late failure) after a successful ingest retried
 *      the whole target and called `ingest` a SECOND time.
 *   2. A transient failure at the very end (e.g. ingest) re-ran the whole
 *      target from scratch on retry — re-generating, re-validating, re-SEOing
 *      — double-charging LLM calls that had already returned successfully.
 *
 * Fix: split each target's processing into two phases.
 *
 * - **Phase A** (`runPhaseA`, below) — LLM-heavy: generate/compose,
 *   validate+repair loop, content-lint(+repair), dedupe-hash, SEO. Runs
 *   EXACTLY ONCE per target attempt and is NOT wrapped in `withRetry`. If it
 *   throws, that's the target's one and only try (see the module-level
 *   decision note below `runPhaseA` for why this repo doesn't also add a
 *   per-call retry inside Phase A). Its own quality-gate drops (validation,
 *   content, dedupe) apply their bookkeeping directly and inline — safe,
 *   because Phase A only ever executes once, so there's no risk of applying
 *   it twice.
 * - **Phase B** (`runPhaseB`, below) — infra: upload, render, near-dup check,
 *   vision critic, ingest. Wrapped in `withRetry` for `transient_infra`
 *   failures, REUSING Phase A's output (`json`/`hash`/`seo`) across every
 *   attempt — it is never regenerated. Render and the vision-critic score are
 *   memoized (`renderMemo`/`criticMemo`, declared OUTSIDE the retried closure
 *   so they survive across attempts): a retry triggered by a LATE failure
 *   (e.g. ingest) reuses whatever Phase B already completed rather than
 *   redoing it — this matters most for the vision critic, which is itself an
 *   LLM call, so a retry must never invoke it again once it has already
 *   returned a verdict.
 * - Phase B's outcome bookkeeping (`applyPhaseBOutcome`) runs ONCE, AFTER
 *   `withRetry` has fully resolved — strictly outside the retry boundary —
 *   closing hole #1 above: nothing that happens after a successful ingest can
 *   ever trigger another one.
 */
/**
 * T4.2: the shared per-layout gate pipeline — ONE function both entry paths run
 * (`runPipeline` for the matrix/vary batch, `runThemePack` for multi-page themes).
 * Processes a SINGLE `PipelineItem` through Phase A (generate/compose → validate
 * +repair → content-lint → mobile-stack → dedupe-hash → SEO) and Phase B (upload
 * → render gate → near-dupe → vision critic → ingest), mutating `ctx.summary`/
 * `ctx.nearDupPool` and emitting `RunEvent`s. Returns the item's terminal
 * `outcome`, its ingest `slug`, and whether the run should `abort` (usage-limit/
 * auth). All the retry-boundary and memoization design below is unchanged from the
 * pre-T4.2 per-target loop body; it was extracted verbatim, parameterized only by
 * the item's pins/composeExtras and the context's `growDedupePools` flag.
 */
export async function processItem(item: PipelineItem, ctx: RunContext): Promise<ItemResult> {
  const { deps, summary, nearDupPool, copyTextPool, maxDistance, maxRetries, retryBaseDelayMs, log, onEvent } = ctx;
  const target = item.target;
  // T2.2: a 'usage_limit' classification means every OTHER remaining target
  // would hit the exact same account-level wall — there's nothing to gain (and
  // real budget/time to lose) by iterating the rest of the batch after that.
  // T2.2 review fix (Minor): 'auth' gets the same treatment — an invalid API key
  // can't recover mid-run either. 'budget' is deliberately NOT included: a
  // per-call budget cap can legitimately be blown by one unusually expensive
  // target while cheaper ones downstream would still succeed. Signaled back to
  // the caller's loop via the returned `abort` flag rather than an early return.
  const ABORT_CODES = new Set(['usage_limit', 'auth']);
  let abort = false;
  // Always the pinned slug for a theme item (known up front, so the theme wrapper
  // can record the page in its pack even on a dedupe/skip); filled in on ingest
  // for a matrix item (its slug isn't known until the SEO step runs).
  let resultSlug: string | undefined = item.pins?.slug;

  // The block below is the pre-T4.2 per-target loop body, extracted verbatim
  // (kept as a block to preserve its scope/indentation and keep the extraction
  // diff reviewable against the old `runPipeline` loop).
  {
    // Per-target usage meter (T4.1). Wraps deps.llm so every call this target makes
    // (generate, repairs, SEO — wherever this wrapped client is threaded through)
    // reports cost/tokens without any of those call sites needing to change. Emitted
    // once as a single `llm_usage` event in `finally`, tagged with this target's
    // final outcome so a consumer never has to infer it from event ordering.
    // T2.2 review fix: Phase A runs exactly once (never retried), and Phase B's
    // retries never re-run Phase A's LLM calls — so unlike the original T2.2 cut,
    // this is no longer "the true total across every full-target attempt"; it's
    // simply this target's one true spend.
    const usage: Required<LlmUsage> = { costUsd: 0, inputTokens: 0, outputTokens: 0 };
    let sawUsage = false;
    let outcome: RunOutcome = 'errored';
    // T1.3: local screenshot temp file paths (if the real renderer produced any)
    // handed to the vision critic — cleaned up unconditionally in `finally`
    // below regardless of which gate/outcome this target hits. T2.2 review fix:
    // render is now memoized (see `renderMemo` below) and only ever executes
    // once per target, so this no longer needs to accumulate across retry
    // attempts — a single push is enough.
    const screenshotPathsToClean: string[] = [];
    const meteredLlm: LlmClient = {
      complete: (input) =>
        deps.llm.complete({
          ...input,
          onUsage: (u) => {
            sawUsage = true;
            usage.costUsd += u.costUsd ?? 0;
            usage.inputTokens += u.inputTokens ?? 0;
            usage.outputTokens += u.outputTokens ?? 0;
            input.onUsage?.(u);
          },
        }),
    };

    // T2.2 review fix: an `onEvent` consumer must never be able to fail (or,
    // worse, retry-and-double-ingest) a target just by throwing. This was the
    // exact reviewer probe for finding #1 — a throwing consumer after a
    // successful ingest previously bubbled up as a "transient" failure and
    // retried the whole target. Every emission in this function goes through
    // `emit`, which swallows and logs instead of propagating.
    const emit = (event: RunEvent) => {
      try {
        onEvent(event);
      } catch (err) {
        log(
          `onEvent handler threw for '${event.type}' on ${target.type}/${target.niche}/${target.style}: ` +
            `${(err as Error).message} (ignored — a consumer error must never fail or retry the target)`,
        );
      }
    };

    // ---- Phase A -----------------------------------------------------------
    // LLM-heavy generation, run EXACTLY ONCE per target: generate/compose,
    // validate+repair loop, content-lint(+repair), dedupe-hash, SEO. Returns
    // `undefined` if a quality gate already dropped/deduped the target (its
    // own bookkeeping is applied inline below, since this only ever runs
    // once) — otherwise the assembled `{ json, hash, seo }` Phase B needs.
    //
    // Deliberately NOT wrapped in `withRetry`: retrying this whole phase on a
    // LATE failure (e.g. Phase B's ingest call) would re-run every completed
    // LLM call (regenerate, re-repair, re-SEO) — exactly the double-charge
    // constraint #7 forbids. If Phase A itself throws (e.g. a transient
    // network blip mid-generation), it is NOT retried here and the target
    // fails after this one try — see `generate.ts`'s own bounded
    // parse-retry loop for the one case where retrying an individual Phase A
    // LLM call already happens (safe: an unparsed response completed no
    // work, so retrying it isn't a double-charge). Adding a broader per-call
    // retry around every other Phase A call would also be constraint-#7-safe
    // in principle, but isn't implemented here — kept out to avoid the
    // complexity/risk of a partial rewrite for a case (a transient blip
    // during generation itself) with no reproducing test or reported
    // incident; it's a reasonable, documented follow-up rather than a gap
    // this fix silently papers over.
    const runPhaseA = async (): Promise<{ json: string; hash: string; seo: LayoutSeo; layoutText: string } | undefined> => {
      let { json } =
        target.type === 'full_landing'
          ? await composeLanding(target, {
              llm: meteredLlm,
              guide: deps.guide,
              maxBudgetUsd: deps.maxBudgetUsd,
              maxParseRetries: deps.maxParseRetries,
              validate: deps.validate,
              maxRepairs: deps.maxRepairs,
              log,
              // T4.2: theme items pin the shared brief/brandFacts/flow here (the
              // cohesion source for a multi-page pack); absent for a matrix
              // full_landing target, which composes its own brief.
              ...(item.composeExtras ?? {}),
            })
          : await generateLayout(target, {
              llm: meteredLlm,
              guide: deps.guide,
              maxBudgetUsd: deps.maxBudgetUsd,
              maxParseRetries: deps.maxParseRetries,
            });
      summary.generated++;
      emit({ type: 'generated', target });

      // Validate + repair loop (hard gate). Full landings are composed from
      // per-section-validated sections, so the assembled document is valid by
      // construction — skip the whole-document repair (a ~50KB single-call repair
      // blows the model's output ceiling); just gate on the final validation.
      let result = await deps.validate(json);
      let attempts = 0;
      const repairsAllowed = target.type === 'full_landing' ? 0 : deps.maxRepairs;
      while (!result.valid && attempts < repairsAllowed) {
        attempts++;
        summary.repaired++;
        emit({ type: 'repair_attempt', target, kind: 'structural' });
        const { system, prompt } = buildRepairPrompt(json, result.violations, target, deps.guide);
        const text = await meteredLlm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
        json = JSON.stringify(extractJson(text));
        result = await deps.validate(json);
      }
      if (!result.valid) {
        summary.qualityDropped++;
        outcome = 'dropped';
        const detail = result.violations.map((v) => v.code).join(',');
        log(`drop ${target.type}/${target.niche}/${target.style}: ${detail}`);
        emit({ type: 'dropped', target, reason: 'validation', detail });
        return undefined;
      }

      // Swap placeholder images for real stock photos (after validation; URL-for-URL,
      // so structure is unchanged). Hash + render + download all see the real images.
      if (deps.resolveImages) json = await deps.resolveImages(json);

      // Content-quality gate: structural validity says nothing about whether the COPY
      // is finished. Reject placeholder tokens, lorem ipsum, demo filler, fake
      // contacts/prices. Full landings are composed from per-section-linted sections,
      // so they're clean by construction — a ~50KB whole-doc content repair would blow
      // the model's output ceiling, so skip the doc-level loop for them.
      // A leftover placeholder-image URL means the Pexels swap missed (infra, best-
      // effort) — never drop a layout with clean copy over that; only warn.
      if (target.type !== 'full_landing') {
        let lint = lintLayoutJson(json);
        emit({ type: 'content_lint', target, hit: lint.length > 0, codes: lint.map((v) => v.code) });
        let lintAttempts = 0;
        const dropWorthy = (vs: typeof lint) => vs.filter((v) => v.code !== 'PLACEHOLDER_IMAGE');
        while (dropWorthy(lint).length && lintAttempts < deps.maxRepairs) {
          lintAttempts++;
          summary.repaired++;
          emit({ type: 'repair_attempt', target, kind: 'content' });
          const { system, prompt } = buildContentRepairPrompt(json, lint, target, deps.guide);
          const text = await meteredLlm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
          json = JSON.stringify(extractJson(text));
          // A copy rewrite must not break structure — re-validate, then re-resolve any
          // new placeholder image URLs the rewrite introduced, then re-lint.
          const revalidate = await deps.validate(json);
          if (!revalidate.valid) break;
          if (deps.resolveImages) json = await deps.resolveImages(json);
          lint = lintLayoutJson(json);
        }
        if (dropWorthy(lint).length) {
          summary.qualityDropped++;
          outcome = 'dropped';
          const detail = dropWorthy(lint).map((v) => v.code).join(',');
          log(`drop(content) ${target.type}/${target.niche}/${target.style}: ${detail}`);
          emit({ type: 'dropped', target, reason: 'content', detail });
          return undefined;
        }
        // T5.2: by construction, anything surviving here (dropWorthy is empty)
        // can only be PLACEHOLDER_IMAGE (the sole code `dropWorthy` excludes) —
        // the Pexels swap missed for at least one image. Best-effort, never a
        // drop reason (see the log line this rides alongside) — but visible in
        // the eval scoreboard via its own RunEvent/metric (placeholder-miss rate).
        if (lint.length) {
          log(`warn(content) ${target.type}/${target.niche}/${target.style}: ${lint.map((v) => v.code).join(',')} (best-effort image miss)`);
          emit({ type: 'placeholder_image_miss', target });
        }
      }

      // Enforce single-column, full-width stacking on phone (deterministic; the
      // model is inconsistent about responsive column sizing). Adds phone-only
      // attributes — desktop layout and validation verdict are unaffected.
      json = stackLayoutJsonMobile(json);

      const hash = contentHash(json);
      if (await deps.isDuplicate(hash)) {
        summary.deduped++;
        outcome = 'deduped';
        log(`dedupe ${hash.slice(0, 12)}`);
        emit({ type: 'deduped', target });
        return undefined;
      }

      // T5.1: deterministic cross-layout boilerplate gate — separate from, and
      // stricter than, the LLM copyScore FLAG below (Phase B). "Obvious" reused
      // copy (high word-shingle overlap with a layout THIS run already accepted)
      // is a hard DROP, decided without any LLM call, so it happens here in Phase
      // A — before SEO/render/vision-critic even run — rather than in Phase B
      // alongside the near-dupe/vision-critic gates: a layout that's already
      // known-boilerplate shouldn't pay for any of that first.
      //
      // Review fix (T5.1 review, Important): this gate runs AFTER the
      // content-hash dedupe check above, not before it (the original ordering
      // had it first). A same-run byte-identical duplicate (identical `json`,
      // therefore identical extracted text) is the SAME layout being
      // resubmitted, not a distinct layout reusing boilerplate wording — it
      // must be classified `deduped` (the pre-existing T1.x semantics), never
      // `copy_boilerplate`. Running dedupe first preserves that: dedupe claims
      // exact repeats, and only non-identical survivors ever reach this
      // shingle-overlap check — which is the gate's actual purpose (catching
      // two DIFFERENT, reworded-but-still-boilerplate layouts).
      //
      // See pipeline/copy-critic.ts's module doc for why the comparison pool is
      // in-run-only, and `RunContext.copyTextPool`'s doc for why theme runs
      // (growDedupePools: false) skip this gate entirely — their pages
      // intentionally share brand copy on purpose. `layoutText` is computed
      // once here and threaded through to Phase B (folded critic prompt +
      // the pool-growing push on ingest) rather than re-extracted there.
      const layoutText = extractLayoutText(json);
      if (ctx.growDedupePools && isCopyBoilerplate(layoutText, copyTextPool)) {
        summary.qualityDropped++;
        outcome = 'dropped';
        const detail = `overlap > ${(copyBoilerplateMaxOverlap() * 100).toFixed(0)}% with previously accepted copy this run`;
        log(`drop(copy_boilerplate) ${target.type}/${target.niche}/${target.style}: ${detail}`);
        emit({ type: 'dropped', target, reason: 'copy_boilerplate', detail });
        return undefined;
      }

      const seo = await generateSeo(json, target, { llm: meteredLlm, maxBudgetUsd: deps.maxBudgetUsd, log });
      // T2.4: surface the quality floor + clamp signals from seo.ts as events —
      // never a drop gate (floor miss) and never information the layout is
      // withheld for (clamps); both are purely visible via log + RunEvent so
      // the eval scoreboard (pipeline/eval/metrics.ts) can count them.
      if (seo.seoFloorMissed) {
        emit({ type: 'seo_floor_miss', target, metaDescriptionLength: seo.metaDescription.trim().length, keywordCount: seo.keywords.length });
      }
      for (const c of seo.seoClamps) {
        emit({ type: 'seo_clamped', target, axis: c.axis, proposed: c.proposed, clamped: c.clamped });
      }
      return { json, hash, seo, layoutText };
    };

    // ---- Phase B ------------------------------------------------------------
    // Infra: upload, render, near-dup check, vision critic, ingest. Wrapped in
    // `withRetry` below for `transient_infra` failures. `renderMemo`/`uploadMemo`/
    // `criticMemo` are declared OUTSIDE `runPhaseB` (in this per-target scope)
    // so they persist across every `withRetry` invocation of it — a retry
    // triggered by a LATE failure (e.g. ingest) reuses whatever already
    // completed rather than redoing it. This matters most for the vision
    // critic: it is itself an LLM call, so once it has returned a verdict a
    // retry must reuse that verdict, never invoke the critic again.
    type PhaseBOutcome =
      | { kind: 'render_failed'; detail?: string }
      | { kind: 'render_blank' }
      | { kind: 'near_duplicate'; distance: number }
      | { kind: 'vision_critic_dropped'; score: number; issues: string[] }
      | { kind: 'vision_critic_error'; detail: string }
      // T5.1: `layoutText` rides along on the ingested outcome so `applyPhaseBOutcome`
      // (declared outside this closure, in `processItem`'s own scope — see its
      // comment) can grow `copyTextPool` for FUTURE targets without needing its
      // own reference to Phase A's `json`.
      | { kind: 'ingested'; seoSlug: string; perceptualHash?: string; layoutText: string };

    const runPhaseB = (phaseA: { json: string; hash: string; seo: LayoutSeo; layoutText: string }) => {
      const { json, hash, seo, layoutText } = phaseA;
      let uploadMemo: UploadResult | undefined;
      interface RenderMemo {
        attempted: boolean;
        succeeded: boolean;
        previewImageKeys: string[];
        perceptualHash?: string;
        screenshotPaths: string[];
        blank: boolean;
        errorDetail?: string;
      }
      let renderMemo: RenderMemo | undefined;
      let criticMemo: VisionCriticResult | undefined;

      return async (): Promise<PhaseBOutcome> => {
        if (!uploadMemo) uploadMemo = await deps.upload(hash, json);
        const { diviJsonBlobKey, previewImageKeys: placeholderPreviews } = uploadMemo;

        // Render real screenshots when a renderer is wired; else keep the
        // placeholders. Memoized: only actually renders on the FIRST Phase B
        // attempt for this target; a later retry (triggered by e.g. ingest)
        // reuses this result rather than re-rendering.
        if (!renderMemo) {
          renderMemo = {
            attempted: false,
            succeeded: false,
            previewImageKeys: [],
            screenshotPaths: [],
            blank: false,
          };
          if (deps.render) {
            renderMemo.attempted = true;
            const parsed = JSON.parse(json) as { post_title?: string; post_content?: string };
            if (parsed.post_content) {
              // Review fix (T1.3): a THROWING deps.render must not fall through to
              // the generic top-level catch below — that would count it as a
              // generic infra error and bypass `renderFailed` entirely. Catch it
              // here so a thrown render takes the exact same path as a render that
              // resolves with no previews: renderSucceeded stays false, and the
              // render-miss gate right below handles it.
              try {
                // T4.2: theme items render under their pinned brand+role title;
                // matrix items use the generated post_title (falling back to SEO).
                const renderTitle = item.pins?.title ?? parsed.post_title ?? seo.title;
                const r = await deps.render({ title: renderTitle, postContent: parsed.post_content, hash });
                if (r.previewImageKeys.length) {
                  renderMemo.succeeded = true;
                  renderMemo.previewImageKeys = r.previewImageKeys;
                  renderMemo.perceptualHash = r.perceptualHash;
                  renderMemo.screenshotPaths = r.screenshotPaths ?? [];
                  screenshotPathsToClean.push(...renderMemo.screenshotPaths);
                } else if (r.outcome === 'blank') {
                  renderMemo.blank = true;
                } else {
                  // Resolved with no previews and no explicit verdict: either the
                  // legacy shape (pre-T2.1 stub/dry-run) or a production wrapper
                  // that swallowed a render exception into `{ error }` — either
                  // way this is the generic render-miss bucket, not a confirmed
                  // blank page.
                  renderMemo.errorDetail = r.error;
                }
              } catch (err) {
                renderMemo.errorDetail = (err as Error).message;
                log(`render threw for ${target.type}/${target.niche}/${target.style}: ${renderMemo.errorDetail}`);
              }
            }
          }
        }

        const previewImageKeys = renderMemo.succeeded ? renderMemo.previewImageKeys : placeholderPreviews;

        // Render-miss gate (T1.3, split by T2.1): closes the swallowed-render
        // hole — a renderer WAS wired for this run but produced no real previews
        // for this target. Never ingest a layout carrying only placeholder
        // previews; count it separately from `qualityDropped` so it's visible in
        // the eval scoreboard as an infra/quality signal, not a generator-quality
        // one. T2.1 splits this into two distinct counters: a CONFIRMED-blank
        // page (`renderBlank` — the render pipeline ran to completion and
        // explicitly verdicted "nothing painted") vs everything else
        // (`renderFailed` — exception, or a resolved render with no previews and
        // no verdict at all).
        if (renderMemo.attempted && !renderMemo.succeeded) {
          return renderMemo.blank ? { kind: 'render_blank' } : { kind: 'render_failed', detail: renderMemo.errorDetail };
        }

        // Near-duplicate gate (T1.2), after render/before ingest. Render is
        // best-effort (T2.1) — no perceptualHash means render was skipped or
        // failed, so skip this gate gracefully rather than block ingest for it.
        if (renderMemo.perceptualHash) {
          const nearest = nearestDistance(renderMemo.perceptualHash, nearDupPool);
          if (nearest !== undefined && nearest <= maxDistance) {
            return { kind: 'near_duplicate', distance: nearest };
          }
          // NOTE: do NOT push into nearDupPool here. Pushing before ingest succeeds
          // would poison the pool with a hash for a layout that never actually got
          // accepted (e.g. ingest throws below) — a later, genuinely distinct target
          // in the same run would then be wrongly near-dupe-dropped against a layout
          // that isn't actually published. Only push after `deps.ingest` resolves AND
          // after `withRetry` has fully settled (review fix — T1.2, tightened T2.2:
          // see `applyPhaseBOutcome` below, strictly outside the retry boundary).
        }

        // Vision critic gate (T1.3), after near-dupe (cheapest-first) and before
        // ingest — this IS the QA since ingest auto-publishes with no human review.
        // Optional/injected like `deps.render`/`deps.resolveImages`: absent means
        // skipped. Only runs once render actually produced real previews — nothing
        // meaningful to critique against placeholders or a render that never happened.
        if (deps.visionCritic && renderMemo.succeeded) {
          // Followups #3: `renderMemo.screenshotPaths` are LOCAL file paths the
          // critic's `claude` CLI call can `Read` (constraint #1) — `previewImageKeys`
          // are Vercel Blob keys it can't open. This USED to fall back to
          // `previewImageKeys` whenever `screenshotPaths` was empty (e.g. a
          // caller that wires a renderer but never populates the T2.1 outcome
          // contract's `screenshotPaths` — see the theme scripts fixed by
          // `buildThemeDeps`, pipeline/deps.ts), silently handing the critic
          // paths it cannot read. Per the documented "no unscored layout ships"
          // policy (see the vision_critic_error case a few lines down): treat a
          // missing local-path set as a render-infra problem the critic can't
          // do its job on, and DROP — never skip the critic and ship the
          // layout un-critiqued, and never substitute unreadable blob keys.
          if (renderMemo.screenshotPaths.length === 0) {
            const detail = 'no local screenshot paths available for the vision critic to read (blob-key fallback removed)';
            log(`vision-critic skipped (${detail}) — dropping ${target.type}/${target.niche}/${target.style}`);
            return { kind: 'vision_critic_error', detail };
          }
          const minScore = deps.visionCriticMinScore ?? 3;
          const criticPaths = renderMemo.screenshotPaths;
          if (criticMemo === undefined) {
            // Deliberate policy (review fix, T1.3; reaffirmed T2.2): this pipeline
            // has no human review (constraint #4) — the critic IS the QA. If it
            // throws (CLI failure) or returns unparseable JSON, that is NOT "it
            // looked fine"; it's treated exactly like a failing score: a QUALITY
            // drop (`qualityDropped`, reason `vision_critic_error`), NOT an infra
            // `errored` — this is a content-quality policy decision (no unscored
            // layout ships), not a signal that infra is unhealthy, so it's never
            // routed through the retry/classification path below and never
            // retried. Logged/tagged distinctly so it's visible as its own failure
            // mode in the eval scoreboard.
            try {
              // T5.1: same CLI call also rates the layout's extracted copy —
              // `text` is additive on `VisionCriticContext` (vision-critic.ts);
              // omitted/empty text (nothing extractable) yields the pre-T5.1
              // visual-only prompt, so this never changes the visual-only path.
              criticMemo = await deps.visionCritic(criticPaths, {
                type: target.type,
                niche: target.niche,
                style: target.style,
                text: layoutText,
              });
            } catch (err) {
              return { kind: 'vision_critic_error', detail: (err as Error).message };
            }
            const passed = meetsQualityBar(criticMemo, minScore);
            emit({ type: 'vision_critic', target, score: criticMemo.score, issues: criticMemo.issues, passed });
            // T5.1: FLAG-only — logged/emitted, but never contributes to `passed`
            // above or to its own drop. Only emitted when the model actually
            // returned a copyScore (additive/optional field — see CopyCriticResult).
            if (criticMemo.copyScore !== undefined) {
              const copyMinScore = deps.copyCriticMinScore ?? 3;
              const copyPassed = meetsCopyBar(criticMemo.copyScore, copyMinScore);
              const copyIssues = criticMemo.copyIssues ?? [];
              emit({ type: 'copy_critic', target, copyScore: criticMemo.copyScore, copyIssues, passed: copyPassed });
              if (!copyPassed) {
                log(
                  `copy-critic flag ${target.type}/${target.niche}/${target.style}: ` +
                    `score ${criticMemo.copyScore} issues=${copyIssues.join(',') || 'none'} (flagged, not dropped)`,
                );
              }
            }
            // T5.2: image relevance — FLAG-only, same policy shape as the copy
            // gate above (never contributes to `passed`/the drop below, on its
            // own). Controller resolution: a below-threshold score is logged +
            // reported, never re-resolved — see `RunEvent`'s `image_relevance`
            // doc for why a re-resolve-and-rescore loop is a documented
            // follow-up rather than implemented here.
            if (criticMemo.imageRelevanceScore !== undefined) {
              const imgMinScore = deps.imageRelevanceMinScore ?? 3;
              const imgPassed = meetsImageRelevanceBar(criticMemo.imageRelevanceScore, imgMinScore);
              const imageIssues = criticMemo.imageIssues ?? [];
              emit({ type: 'image_relevance', target, imageRelevanceScore: criticMemo.imageRelevanceScore, imageIssues, passed: imgPassed });
              if (!imgPassed) {
                log(
                  `image-relevance flag ${target.type}/${target.niche}/${target.style}: ` +
                    `score ${criticMemo.imageRelevanceScore} issues=${imageIssues.join(',') || 'none'} (flagged, not dropped)`,
                );
              }
            }
            if (!passed) return { kind: 'vision_critic_dropped', score: criticMemo.score, issues: criticMemo.issues };
          } else {
            // T2.2 review fix: already scored in a prior Phase B attempt for this
            // target — reuse the held verdict. Do NOT re-invoke the critic (an LLM
            // call) and do NOT re-emit the `vision_critic` event a second time.
            if (!meetsQualityBar(criticMemo, minScore)) {
              return { kind: 'vision_critic_dropped', score: criticMemo.score, issues: criticMemo.issues };
            }
          }
        }

        // T4.2: one payload builder for both paths — matrix defaults
        // (`variantSlug` + SEO-inferred axes) or a theme item's pinned
        // slug/title/axes. See `buildIngestPayload`.
        const payload = buildIngestPayload(item, seo, {
          diviJsonBlobKey,
          previewImageKeys,
          hash,
          perceptualHash: renderMemo.perceptualHash,
        });
        await deps.ingest(payload);
        return { kind: 'ingested', seoSlug: seo.slug, perceptualHash: renderMemo.perceptualHash, layoutText };
      };
    };

    // Bookkeeping for a Phase B terminal outcome. Applied EXACTLY ONCE, and
    // ONLY after `withRetry` has fully resolved (see the call site below) —
    // this is the T2.2 review fix for finding #1: nothing that runs after a
    // successful ingest (summary++, log, nearDupPool push, the `'ingested'`
    // event) can trigger another retry/re-ingest, because by the time any of
    // it runs, the retry loop is already done.
    const applyPhaseBOutcome = (o: {
      kind: 'render_failed' | 'render_blank' | 'near_duplicate' | 'vision_critic_dropped' | 'vision_critic_error' | 'ingested';
      detail?: string;
      distance?: number;
      score?: number;
      issues?: string[];
      seoSlug?: string;
      perceptualHash?: string;
      layoutText?: string;
    }) => {
      switch (o.kind) {
        case 'render_failed':
          summary.renderFailed++;
          outcome = 'render_failed';
          log(`render-miss drop ${target.type}/${target.niche}/${target.style}: ${o.detail ?? 'no real previews'}`);
          emit({ type: 'render_failed', target, detail: o.detail });
          break;
        case 'render_blank':
          summary.renderBlank++;
          outcome = 'render_blank';
          log(`render-blank drop ${target.type}/${target.niche}/${target.style}: page never confirmably painted content`);
          emit({ type: 'render_blank', target });
          break;
        case 'near_duplicate':
          summary.nearDuped++;
          outcome = 'near_duplicate';
          log(`near-dupe drop ${target.type}/${target.niche}/${target.style}: distance ${o.distance}`);
          emit({ type: 'near_duplicate', target, distance: o.distance as number });
          break;
        case 'vision_critic_dropped': {
          summary.qualityDropped++;
          outcome = 'dropped';
          const detail = `score ${o.score} issues=${(o.issues ?? []).join(',') || 'none'}`;
          log(`vision-critic drop ${target.type}/${target.niche}/${target.style}: ${detail}`);
          emit({ type: 'dropped', target, reason: 'vision_critic', detail });
          break;
        }
        case 'vision_critic_error':
          summary.qualityDropped++;
          outcome = 'dropped';
          log(`[run] vision critic errored — dropping unscored layout: ${o.detail}`);
          emit({ type: 'dropped', target, reason: 'vision_critic_error', detail: o.detail as string });
          break;
        case 'ingested':
          // Only a layout that actually cleared ingest joins the near-dupe pool —
          // see the NOTE above where the gate runs. T4.2: skipped entirely for
          // theme runs (`growDedupePools` false) so sibling pages of ONE pack —
          // intentionally same-palette, shared header/footer bands — never
          // near-dupe-drop each other.
          if (o.perceptualHash && ctx.growDedupePools) nearDupPool.push(o.perceptualHash);
          // T5.1: same reuse-of-`growDedupePools` rationale as the near-dupe pool
          // above — grows the in-run boilerplate-comparison pool only for matrix/
          // vary runs, never for a theme pack's own sibling pages.
          if (o.layoutText && ctx.growDedupePools) copyTextPool.push(o.layoutText);
          summary.ingested++;
          outcome = 'ingested';
          // Matrix items learn their slug only here (post-SEO); theme items were
          // already pinned. Either way `resultSlug` ends up correct for the caller.
          if (!resultSlug) resultSlug = o.seoSlug;
          log(`ingested ${o.seoSlug}`);
          emit({ type: 'ingested', target, slug: o.seoSlug as string });
          break;
      }
    };

    // T2.2: shared with the `catch` below (a `let` inside `try {}` isn't
    // visible there) so the `errored` event can report how many tries this
    // target actually got. T2.2 review fix: this now counts Phase B attempts
    // specifically (Phase A never retries, so it's always exactly one try) —
    // falls back to 1 if Phase A itself threw before Phase B ever started.
    let phaseBAttempts = 0;
    try {
      const phaseA = await runPhaseA();
      if (phaseA !== undefined) {
        const phaseB = runPhaseB(phaseA);
        const phaseBOutcome = await withRetry(
          () => {
            phaseBAttempts++;
            return phaseB();
          },
          {
            retries: maxRetries,
            baseDelayMs: retryBaseDelayMs,
            sleep: deps.sleep,
            onRetry: ({ attempt, classified }) => {
              log(
                `retry ${attempt}/${maxRetries} for ${target.type}/${target.niche}/${target.style} ` +
                  `[${classified.class}/${classified.code}]: ${classified.message}`,
              );
              emit({ type: 'retry', target, attempt, code: classified.code, detail: classified.message });
            },
          },
        );
        // Bookkeeping happens here — strictly OUTSIDE the retry boundary.
        applyPhaseBOutcome(phaseBOutcome);
      }
      // NOTE: a `phaseA === undefined` result covers every Phase A quality-gate
      // early return (validation/content/dedupe), whose own bookkeeping already
      // ran inline above — nothing more to do. Only a real infra failure from
      // Phase A or Phase B reaches the `catch` below.
    } catch (err) {
      const classified = classifyError(err);
      summary.errored++;
      outcome = 'errored';
      log(
        `error on ${target.type}/${target.niche}/${target.style} ` +
          `[${classified.class}/${classified.code}]: ${classified.message}`,
      );
      emit({
        type: 'errored',
        target,
        class: classified.class,
        code: classified.code,
        detail: classified.message,
        attempts: phaseBAttempts || 1,
      });
      // T2.2: an account-level wall (usage-limit) or an invalid credential
      // (auth) means every other remaining target would hit it identically —
      // abort the rest of the run rather than burn time reproving that for
      // each one. See `ABORT_CODES` above for what's included and why.
      if (ABORT_CODES.has(classified.code)) {
        log(`${classified.code} hit — aborting the remaining target(s) in this run`);
        abort = true;
      }
    } finally {
      if (sawUsage) emit({ type: 'llm_usage', target, usage, outcome });
      // T1.3: these are scratch temp files written solely so the vision critic's
      // CLI call could Read them — runs on every exit path (any gate's early
      // return, a thrown error, or a clean ingest) so they never leak across a
      // batch run. T2.2 review fix: render is memoized and only ever runs once
      // per target now, so this list holds at most one render's worth of paths.
      if (screenshotPathsToClean.length) {
        await Promise.all(screenshotPathsToClean.map((p) => rm(p, { force: true }).catch(() => {})));
        // Review fix (T1.3): rm'ing the files above leaves the mkdtemp PARENT
        // directory (`ll-shot-*`, created by pipeline/deps.ts's real renderer)
        // behind, empty, on every real run. Remove it too — but ONLY when its
        // basename actually looks like one of ours, so this can never be
        // tricked into recursively deleting some unrelated directory (e.g. a
        // differently-wired renderer, or a test fixture, pointing
        // `screenshotPaths` at a path whose parent is something precious).
        const shotDirs = new Set(
          screenshotPathsToClean.map((p) => dirname(p)).filter((d) => basename(d).startsWith('ll-shot-')),
        );
        await Promise.all([...shotDirs].map((d) => rm(d, { recursive: true, force: true }).catch(() => {})));
      }
    }

    return { outcome, slug: resultSlug, abort };
  }
}

/**
 * T4.2: the matrix/vary entry path — a thin loop over `deps.targets`, each run
 * through the shared `processItem` gate pipeline. `growDedupePools: true` keeps
 * the pre-T4.2 behavior where a `vary` batch minting several near-identical
 * layouts drops the later ones against the earlier ones (both the pixel
 * near-dupe pool and, since T5.1, the text-boilerplate pool). Aborts the
 * remaining targets on a usage-limit/auth signal (see `processItem`'s `abort`).
 */
export async function runPipeline(deps: RunDeps): Promise<RunSummary> {
  const ctx = await createRunContext(deps, { growDedupePools: true });
  for (const target of deps.targets) {
    const { abort } = await processItem({ target }, ctx);
    if (abort) break;
  }
  return ctx.summary;
}
