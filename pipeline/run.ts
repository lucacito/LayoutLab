// pipeline/run.ts
import { rm } from 'node:fs/promises';
import type { LlmClient, LlmUsage } from './llm';
import type { Target, Guide } from './recipes';
import { buildRepairPrompt, buildContentRepairPrompt } from './recipes';
import { extractJson } from './llm';
import { generateLayout } from './generate';
import { composeLanding } from '@/pipeline/compose';
import { generateSeo } from './seo';
import { contentHash, nearestDistance, perceptualDupeMaxDistance } from './dedupe';
import { stackLayoutJsonMobile } from './stack-mobile';
import { lintLayoutJson } from './content-lint';
import type { ValidationResult } from './validate';
import type { UploadResult } from './upload';
import type { IngestPayload } from '@/lib/ingest/schema';
import type { VisionCriticContext, VisionCriticResult } from './vision-critic';

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
  dropped: number;
  deduped: number;
  ingested: number;
  /** Dropped for being within `PERCEPTUAL_DUPE_MAX_DISTANCE` of another hash —
   * either one already in the DB or one accepted earlier in this same run
   * (T1.2). Distinct from `deduped` (exact content-hash match). */
  nearDuped: number;
  /** T1.3: a renderer WAS wired (a real, non-dry-run pipeline call) but produced
   * no real previews for this target — closes the swallowed-render hole where a
   * layout carrying only placeholder previews would otherwise sail through to
   * ingest. Distinct from `dropped` (which covers validation/content/error
   * drops) and a no-op when `deps.render` is absent entirely (dry-run/unit
   * tests) — see the render-miss gate in `runPipeline` for the exact condition. */
  renderFailed: number;
}

/** Terminal fate of one target — reported on the paired `llm_usage` event so a
 * consumer can attribute cost/tokens to "accepted" without depending on event
 * ordering. */
export type RunOutcome = 'ingested' | 'dropped' | 'deduped' | 'near_duplicate' | 'render_failed';

/**
 * Additive instrumentation feed (T4.1 eval harness) alongside `RunSummary`.
 * `RunSummary` stays the pipeline's small, stable counter contract; `RunEvent`
 * is the richer per-target detail feed the eval harness aggregates into a
 * scoreboard. Consuming it is entirely optional — omitting `RunDeps.onEvent`
 * changes no pipeline behavior. New quality gates (T1.2 near-dupe, T1.3 vision
 * critic, T2.2 error classes) should add a new event variant here rather than
 * grow RunSummary or reshape this union.
 */
export type RunEvent =
  | { type: 'generated'; target: Target }
  | { type: 'repair_attempt'; target: Target; kind: 'structural' | 'content' }
  | { type: 'content_lint'; target: Target; hit: boolean; codes: string[] }
  | { type: 'dropped'; target: Target; reason: 'validation' | 'content' | 'error'; detail: string }
  | { type: 'deduped'; target: Target }
  /** Perceptual-hash near-duplicate drop (T1.2) — see `RunSummary.nearDuped`. */
  | { type: 'near_duplicate'; target: Target; distance: number }
  /** Render-miss drop (T1.3) — see `RunSummary.renderFailed`. */
  | { type: 'render_failed'; target: Target }
  /** Vision-critic score for this target (T1.3), emitted whether it passed or
   * dropped — the eval harness (T4.1) aggregates these into a score distribution. */
  | { type: 'vision_critic'; target: Target; score: number; issues: string[]; passed: boolean }
  | { type: 'ingested'; target: Target; slug: string }
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
   * which are blob storage keys the critic (a CLI file-reading agent) can't open. */
  render?: (input: { title: string; postContent: string; hash: string }) => Promise<{
    previewImageKeys: string[];
    perceptualHash?: string;
    screenshotPaths?: string[];
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
  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;
  maxRepairs: number;
  maxParseRetries?: number;
  maxBudgetUsd?: number;
  log?: (msg: string) => void;
  /** Additive instrumentation hook (T4.1) — see `RunEvent`. */
  onEvent?: (event: RunEvent) => void;
}

export async function runPipeline(deps: RunDeps): Promise<RunSummary> {
  const log = deps.log ?? (() => {});
  const onEvent = deps.onEvent ?? (() => {});
  const summary: RunSummary = { generated: 0, repaired: 0, dropped: 0, deduped: 0, ingested: 0, nearDuped: 0, renderFailed: 0 };
  const maxDistance = perceptualDupeMaxDistance();
  // Near-duplicate pool (T1.2): seeded once from the DB (or empty if the dep is
  // omitted), then grown with every perceptual hash THIS run accepts, so later
  // targets in the same batch are checked against earlier ones too.
  const nearDupPool: string[] = deps.nearDuplicateHashes ? await deps.nearDuplicateHashes() : [];

  for (const target of deps.targets) {
    // Per-target usage meter (T4.1). Wraps deps.llm so every call this target makes
    // (generate, repairs, SEO — wherever this wrapped client is threaded through)
    // reports cost/tokens without any of those call sites needing to change. Emitted
    // once as a single `llm_usage` event in `finally`, tagged with this target's
    // final outcome so a consumer never has to infer it from event ordering.
    const usage: Required<LlmUsage> = { costUsd: 0, inputTokens: 0, outputTokens: 0 };
    let sawUsage = false;
    let outcome: RunOutcome = 'dropped';
    // T1.3: local screenshot temp file paths (if the real renderer produced any)
    // handed to the vision critic — cleaned up unconditionally in `finally`
    // below regardless of which gate/outcome this target hits.
    let localScreenshotPaths: string[] = [];
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

    try {
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
            })
          : await generateLayout(target, {
              llm: meteredLlm,
              guide: deps.guide,
              maxBudgetUsd: deps.maxBudgetUsd,
              maxParseRetries: deps.maxParseRetries,
            });
      summary.generated++;
      onEvent({ type: 'generated', target });

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
        onEvent({ type: 'repair_attempt', target, kind: 'structural' });
        const { system, prompt } = buildRepairPrompt(json, result.violations);
        const text = await meteredLlm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
        json = JSON.stringify(extractJson(text));
        result = await deps.validate(json);
      }
      if (!result.valid) {
        summary.dropped++;
        outcome = 'dropped';
        const detail = result.violations.map((v) => v.code).join(',');
        log(`drop ${target.type}/${target.niche}/${target.style}: ${detail}`);
        onEvent({ type: 'dropped', target, reason: 'validation', detail });
        continue;
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
        onEvent({ type: 'content_lint', target, hit: lint.length > 0, codes: lint.map((v) => v.code) });
        let lintAttempts = 0;
        const dropWorthy = (vs: typeof lint) => vs.filter((v) => v.code !== 'PLACEHOLDER_IMAGE');
        while (dropWorthy(lint).length && lintAttempts < deps.maxRepairs) {
          lintAttempts++;
          summary.repaired++;
          onEvent({ type: 'repair_attempt', target, kind: 'content' });
          const { system, prompt } = buildContentRepairPrompt(json, lint);
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
          summary.dropped++;
          outcome = 'dropped';
          const detail = dropWorthy(lint).map((v) => v.code).join(',');
          log(`drop(content) ${target.type}/${target.niche}/${target.style}: ${detail}`);
          onEvent({ type: 'dropped', target, reason: 'content', detail });
          continue;
        }
        if (lint.length) log(`warn(content) ${target.type}/${target.niche}/${target.style}: ${lint.map((v) => v.code).join(',')} (best-effort image miss)`);
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
        onEvent({ type: 'deduped', target });
        continue;
      }

      const seo = await generateSeo(json, target, { llm: meteredLlm, maxBudgetUsd: deps.maxBudgetUsd });
      const { diviJsonBlobKey, previewImageKeys: placeholderPreviews } = await deps.upload(hash, json);

      // Render real screenshots when a renderer is wired; else keep the placeholders.
      let previewImageKeys = placeholderPreviews;
      let perceptualHash: string | undefined;
      let renderedScreenshotPaths: string[] = [];
      // `renderAttempted` tracks whether a renderer is wired at all (a real,
      // non-dry-run pipeline call); `renderSucceeded` tracks whether it actually
      // produced real previews. The render-miss gate below only fires when a
      // renderer was wired AND failed to produce previews — when no renderer is
      // wired (dry-run/unit tests without a `render` dep), `renderAttempted`
      // stays false and behavior is byte-for-byte what it was before T1.3.
      let renderAttempted = false;
      let renderSucceeded = false;
      if (deps.render) {
        renderAttempted = true;
        const parsed = JSON.parse(json) as { post_title?: string; post_content?: string };
        if (parsed.post_content) {
          const r = await deps.render({ title: parsed.post_title ?? seo.title, postContent: parsed.post_content, hash });
          if (r.previewImageKeys.length) {
            previewImageKeys = r.previewImageKeys;
            perceptualHash = r.perceptualHash;
            renderedScreenshotPaths = r.screenshotPaths ?? [];
            localScreenshotPaths = renderedScreenshotPaths;
            renderSucceeded = true;
          }
        }
      }

      // Render-miss gate (T1.3): closes the swallowed-render hole — a renderer
      // WAS wired for this run but produced no real previews for this target
      // (e.g. deps.ts's real renderer catches a WP/Playwright failure and
      // returns `previewImageKeys: []`). Never ingest a layout carrying only
      // placeholder previews; count it separately from `dropped` so it's visible
      // in the eval scoreboard as an infra signal, not a generator-quality one.
      if (renderAttempted && !renderSucceeded) {
        summary.renderFailed++;
        outcome = 'render_failed';
        log(`render-miss drop ${target.type}/${target.niche}/${target.style}: no real previews`);
        onEvent({ type: 'render_failed', target });
        continue;
      }

      // Near-duplicate gate (T1.2), after render/before ingest. Render is
      // best-effort (T2.1) — no perceptualHash means render was skipped or
      // failed, so skip this gate gracefully rather than block ingest for it.
      if (perceptualHash) {
        const nearest = nearestDistance(perceptualHash, nearDupPool);
        if (nearest !== undefined && nearest <= maxDistance) {
          summary.nearDuped++;
          outcome = 'near_duplicate';
          log(`near-dupe drop ${target.type}/${target.niche}/${target.style}: distance ${nearest}`);
          onEvent({ type: 'near_duplicate', target, distance: nearest });
          continue;
        }
        // NOTE: do NOT push into nearDupPool here. Pushing before ingest succeeds
        // would poison the pool with a hash for a layout that never actually got
        // accepted (e.g. ingest throws below) — a later, genuinely distinct target
        // in the same run would then be wrongly near-dupe-dropped against a layout
        // that isn't actually published. Only push after `deps.ingest` resolves
        // (review fix — T1.2).
      }

      // Vision critic gate (T1.3), after near-dupe (cheapest-first) and before
      // ingest — this IS the QA since ingest auto-publishes with no human review.
      // Optional/injected like `deps.render`/`deps.resolveImages`: absent means
      // skipped. Only runs once render actually produced real previews — nothing
      // meaningful to critique against placeholders or a render that never happened.
      if (deps.visionCritic && renderSucceeded) {
        const minScore = deps.visionCriticMinScore ?? 3;
        const criticPaths = renderedScreenshotPaths.length ? renderedScreenshotPaths : previewImageKeys;
        const critic = await deps.visionCritic(criticPaths, { type: target.type, niche: target.niche, style: target.style });
        const passed = critic.score >= minScore;
        onEvent({ type: 'vision_critic', target, score: critic.score, issues: critic.issues, passed });
        if (!passed) {
          summary.dropped++;
          outcome = 'dropped';
          log(`vision-critic drop ${target.type}/${target.niche}/${target.style}: score ${critic.score} issues=${critic.issues.join(',') || 'none'}`);
          continue;
        }
      }

      const payload: IngestPayload = {
        slug: variantSlug(seo.slug, target),
        title: seo.title,
        description: seo.metaDescription,
        type: seo.axes.type,
        niche: seo.axes.niche,
        style: seo.axes.style,
        // Record the driven variation color first, then any colors the SEO step inferred.
        colors: target.color ? [target.color, ...seo.axes.colors.filter((c) => c !== target.color)] : seo.axes.colors,
        diviJsonBlobKey,
        previewImageKeys,
        contentHash: hash,
        perceptualHash,
        variant: target.variant,
        validatorPassed: true,
        seo: { metaTitle: seo.title, metaDescription: seo.metaDescription, keywords: seo.keywords },
        tags: [
          { axis: 'type', slug: seo.axes.type },
          { axis: 'niche', slug: seo.axes.niche },
          { axis: 'style', slug: seo.axes.style },
        ],
      };
      await deps.ingest(payload);
      // Only a layout that actually cleared ingest joins the near-dupe pool — see
      // the NOTE above where the gate runs.
      if (perceptualHash) nearDupPool.push(perceptualHash);
      summary.ingested++;
      outcome = 'ingested';
      log(`ingested ${seo.slug}`);
      onEvent({ type: 'ingested', target, slug: seo.slug });
    } catch (err) {
      summary.dropped++;
      outcome = 'dropped';
      const detail = (err as Error).message;
      log(`error on ${target.type}/${target.niche}/${target.style}: ${detail}`);
      onEvent({ type: 'dropped', target, reason: 'error', detail });
    } finally {
      if (sawUsage) onEvent({ type: 'llm_usage', target, usage, outcome });
      // T1.3: these are scratch temp files written solely so the vision critic's
      // CLI call could Read them — runs on every exit path (any gate's `continue`,
      // a thrown error, or a clean ingest) so they never leak across a batch run.
      if (localScreenshotPaths.length) {
        await Promise.all(localScreenshotPaths.map((p) => rm(p, { force: true }).catch(() => {})));
      }
    }
  }
  return summary;
}
