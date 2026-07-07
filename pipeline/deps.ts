// pipeline/deps.ts — shared dependency-construction logic for the pipeline CLI
// (`pipeline/index.ts`) and the eval harness (`scripts/eval-generator.ts`). Both
// must wire the EXACT same real deps as `run.ts`'s `RunDeps` contract — that's
// what makes the harness measure the real path (T4.1 acceptance criterion).
// Extracted here so a future change to the real wiring (new upload target,
// render env, ingest URL resolution, etc.) automatically propagates to both
// callers instead of silently drifting apart between two copy-pasted blocks.
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { and, desc, eq, isNotNull, notLike } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from './llm';
import { loadGrounding, type Target } from './recipes';
import { validateLayout } from './validate';
import { uploadLayout, uploadScreenshot } from './upload';
import { realRenderDeps, renderLayout, type RenderDeps, type RenderResult } from './render';
import { resolveLayoutImages, pexelsSearcher } from './images';
import { postIngest } from './ingest';
import { claudeVisionCritic } from './vision-critic';
import { slugify } from './seo';
import type { RunDeps, RunEvent } from './run';
import type { ThemeDeps } from './theme';

export async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'layout-'));
  const file = join(dir, 'layout.json');
  await writeFile(file, json);
  try {
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export interface CaptureScreenshotsDeps {
  hasBlobToken: boolean;
  /** Override the real `uploadScreenshot`/`writeFile`/`mkdtemp`/`rm` calls —
   * used by tests to simulate a mid-loop failure without a real Blob token or
   * filesystem dependency on a specific tmp layout. */
  uploadScreenshot?: (hash: string, label: string, data: Buffer, deps: { hasBlobToken: boolean }) => Promise<string>;
  writeFile?: (path: string, data: Buffer) => Promise<void>;
  mkdtemp?: (prefix: string) => Promise<string>;
  rm?: (path: string, opts: { recursive?: boolean; force?: boolean }) => Promise<void>;
}

/**
 * Uploads each rendered shot to Blob AND writes it to a local temp file under a
 * fresh `ll-shot-*` dir — the vision critic (T1.3) needs real file paths it can
 * `Read`, not blob storage keys. If ANY step throws partway through this loop
 * (e.g. `uploadScreenshot` fails for the mobile shot after the desktop PNG was
 * already written to disk), the already-written temp dir is removed before
 * rethrowing — review fix (T1.3): the previous inline version of this logic
 * returned `{ previewImageKeys: [] }` on any failure without ever cleaning up
 * whatever had already been written, leaking a temp dir + partial files on
 * every partial render failure. Extracted out of the `render` closure below
 * and dependency-injected (mkdtemp/writeFile/rm/uploadScreenshot all
 * overridable) so this cleanup-on-failure path is independently unit-testable
 * without a real renderer, Blob token, or filesystem.
 */
export async function captureScreenshots(
  shots: { label: string; buffer: Buffer }[],
  hash: string,
  deps: CaptureScreenshotsDeps,
): Promise<{ previewImageKeys: string[]; screenshotPaths: string[] }> {
  const doMkdtemp = deps.mkdtemp ?? mkdtemp;
  const doWriteFile = deps.writeFile ?? writeFile;
  const doRm = deps.rm ?? rm;
  const doUploadScreenshot = deps.uploadScreenshot ?? uploadScreenshot;
  const shotDir = await doMkdtemp(join(tmpdir(), 'll-shot-'));
  try {
    const keys: string[] = [];
    const screenshotPaths: string[] = [];
    for (const label of ['desktop', 'mobile'] as const) {
      const shot = shots.find((s) => s.label === label);
      if (shot) {
        keys.push(await doUploadScreenshot(hash, label, shot.buffer, { hasBlobToken: deps.hasBlobToken }));
        const path = join(shotDir, `${label}.png`);
        await doWriteFile(path, shot.buffer);
        screenshotPaths.push(path);
      }
    }
    return { previewImageKeys: keys, screenshotPaths };
  } catch (e) {
    await doRm(shotDir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

export interface RenderAndCaptureDeps {
  /** Injectable for tests — production always passes the real `renderLayout`. */
  renderLayout: (input: { title: string; postContent: string }, renderDeps: RenderDeps) => Promise<RenderResult>;
  renderDeps: RenderDeps;
  /** Injectable for tests so a stubbed `renderLayout` never has to touch the
   * real filesystem/Blob upload path. Production always passes the real
   * `captureScreenshots`. */
  captureScreenshots?: typeof captureScreenshots;
  hasBlobToken: boolean;
  logPrefix: string;
  /** Review fix (T2.1 minor): route blank/failed warnings through the same
   * injectable logger `run.ts` uses (`RunDeps.log`) instead of a bare
   * `console.warn`, so pipeline output goes through one consistent channel.
   * Defaults to `console.warn` (unchanged behavior) when not supplied — kept
   * optional so existing callers/tests don't need updating.
   *
   * NOTE (final-review fix): `RunDeps.log` (what `buildRunDeps` actually wires
   * in here) already prepends `logPrefix` itself — see its definition in
   * `buildRunDeps` below. So when `log` IS supplied, `logPrefix` is deliberately
   * left OUT of the message passed to it (the caller's logger owns prefixing);
   * `logPrefix` is only prepended on the `console.warn` fallback path, which has
   * no built-in prefix of its own. Prepending it in both places produced
   * `[pipeline] [pipeline] ...` lines. */
  log?: (message: string) => void;
}

export interface RenderAndCaptureResult {
  previewImageKeys: string[];
  perceptualHash?: string;
  screenshotPaths?: string[];
  /** T2.1: present on a resolved (non-throwing) render — 'ok' or 'blank'.
   * Absent when the render step itself threw (see `error` below); the caller
   * (run.ts) treats a missing `outcome` + empty `previewImageKeys` as the
   * legacy/generic render-miss ('failed') case. */
  outcome?: 'ok' | 'blank';
  /** T2.1: the thrown error's message, when `renderLayout`/`captureScreenshots`
   * threw — surfaced on the `render_failed` RunEvent's `detail` field (a Minor
   * from T1.3's review). Never set alongside `outcome` (an exception preempts
   * ever reaching the outcome branches). */
  error?: string;
}

/**
 * T2.1 — the extracted, independently-testable version of `buildRunDeps`'s
 * `render` closure. Preserves the THREE distinct outcomes `run.ts` gates on:
 *  - renderLayout resolves `{ outcome: 'ok' }` → captures screenshots, returns
 *    real previews (`outcome: 'ok'`).
 *  - renderLayout resolves `{ outcome: 'blank' }` → NO captureScreenshots call
 *    (nothing real to upload), returns `{ previewImageKeys: [], outcome: 'blank' }`.
 *  - renderLayout OR captureScreenshots THROWS → swallowed here (matching
 *    T1.3's existing "never let a render exception escape to a production
 *    caller" convention) into a resolved `{ previewImageKeys: [], error }` —
 *    distinct from `blank`, so run.ts's render-miss gate can tell a confirmed-
 *    empty page apart from an infra failure.
 */
export async function renderAndCapture(
  input: { title: string; postContent: string; hash: string },
  deps: RenderAndCaptureDeps,
): Promise<RenderAndCaptureResult> {
  const doCapture = deps.captureScreenshots ?? captureScreenshots;
  // See the `log` field's doc above: a supplied `log` (e.g. `RunDeps.log`) already
  // prepends `logPrefix` itself, so don't prefix again here — only the bare
  // `console.warn` fallback (which has no prefix of its own) gets `logPrefix` added.
  const doLog = (message: string) => (deps.log ? deps.log(message) : console.warn(`${deps.logPrefix} ${message}`));
  try {
    const result = await deps.renderLayout({ title: input.title, postContent: input.postContent }, deps.renderDeps);
    if (result.outcome === 'blank') {
      doLog(`render blank for ${input.hash.slice(0, 12)}: page never confirmably painted content`);
      return { previewImageKeys: [], outcome: 'blank' };
    }
    const { previewImageKeys, screenshotPaths } = await doCapture(result.shots, input.hash, { hasBlobToken: deps.hasBlobToken });
    return { previewImageKeys, perceptualHash: result.perceptualHash, screenshotPaths, outcome: 'ok' };
  } catch (e) {
    const message = (e as Error).message;
    doLog(`render failed for ${input.hash.slice(0, 12)}: ${message}`);
    return { previewImageKeys: [], error: message };
  }
}

export function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
}
export const hasFlag = (name: string) => process.argv.includes(`--${name}`);

export interface BuildRunDepsOptions {
  targets: Target[];
  /** Stub llm/validate/isDuplicate/ingest and skip the renderer — matches
   * `npm run pipeline -- <mode> --dry-run` semantics. */
  dryRun: boolean;
  /** Log-line prefix, e.g. `[pipeline]` or `[eval]`. */
  logPrefix?: string;
  /** Additive instrumentation hook (T4.1) — forwarded verbatim to `RunDeps.onEvent`. */
  onEvent?: (event: RunEvent) => void;
}

/** Build the real `RunDeps` (or dry-run stubs) exactly as `npm run pipeline`
 * does — the single source of truth both the CLI entry and the eval harness
 * call, so they can never drift apart on what "the real path" means. */
export async function buildRunDeps(opts: BuildRunDepsOptions): Promise<{ deps: RunDeps; close: () => Promise<void> }> {
  const { targets, dryRun, onEvent } = opts;
  const logPrefix = opts.logPrefix ?? '[pipeline]';

  // Single logger shared by `RunDeps.log`, `renderAndCapture`'s blank/failed
  // warnings (T2.1 minor review fix), and `loadGrounding`'s guide-extraction
  // warnings (T3.3 minor review fix) — one consistent channel instead of
  // several console.log/console.warn call sites. Defined before `loadGrounding`
  // so it can be threaded straight in rather than logging separately after.
  const log = (m: string) => console.log(`${logPrefix} ${m}`);

  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir, log);

  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3000';
  const ingestToken = process.env.INGEST_API_TOKEN ?? '';
  const maxBudget = process.env.PIPELINE_MAX_BUDGET_USD ? Number(process.env.PIPELINE_MAX_BUDGET_USD) : 1; // per-LLM-call cap (applied to generate + each repair + SEO); not a per-run total

  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const renderer = dryRun ? null : await realRenderDeps();
  const pexelsKey = process.env.PEXELS_API_KEY;

  const stubLlm = { complete: async () => '{"content":[]}' };
  const deps: RunDeps = {
    targets,
    guide,
    llm: dryRun ? stubLlm : claudeCliClient({ model: process.env.PIPELINE_MODEL }),
    validate: dryRun ? async () => ({ valid: true, violations: [] }) : (json) => withTempFile(json, (f) => validateLayout(f)),
    resolveImages: !dryRun && pexelsKey ? (json) => resolveLayoutImages(json, pexelsSearcher(pexelsKey)) : undefined,
    isDuplicate: async (hash) => {
      if (dryRun) return false;
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.contentHash, hash)).limit(1);
      return hit.length > 0;
    },
    // T1.2 near-dupe gate: pool of existing perceptual hashes to check the newly
    // rendered hash against, in addition to whatever this run itself accepts.
    // Capped + most-recent-first — a full-table scan of every layout ever
    // ingested isn't worth it for a best-effort visual-similarity check.
    nearDuplicateHashes: async () => {
      if (dryRun) return [];
      const rows = await db
        .select({ perceptualHash: layouts.perceptualHash })
        .from(layouts)
        .where(isNotNull(layouts.perceptualHash))
        .orderBy(desc(layouts.createdAt))
        .limit(2000);
      return rows.map((r) => r.perceptualHash).filter((h): h is string => !!h);
    },
    upload: (hash, json) => uploadLayout(hash, json, { hasBlobToken, outDir: 'pipeline/out' }),
    // T2.1: `renderAndCapture` (this file, above) also persists each shot to a
    // local temp file on a real render — the vision critic runs through the
    // `claude` CLI (constraint #1) and needs real FILE PATHS it can Read, not
    // the blob keys uploadScreenshot returns. Cleaned up by run.ts once it's
    // done with them (and, on a partial failure inside captureScreenshots,
    // by captureScreenshots itself — review fix, T1.3).
    render: renderer
      ? (input) => renderAndCapture(input, { renderLayout, renderDeps: renderer.deps, hasBlobToken, logPrefix, log })
      : undefined,
    // T1.3 vision critic — optional/injected like render/resolveImages; skipped
    // entirely in dry-run (there's no renderer to produce real screenshots for
    // it to score anyway). VISION_CRITIC_MODEL lets a cheaper model do scoring
    // than the generator uses; the same PIPELINE_MAX_BUDGET_USD cap applies.
    visionCritic: dryRun ? undefined : claudeVisionCritic({ model: process.env.VISION_CRITIC_MODEL, maxBudgetUsd: maxBudget }),
    visionCriticMinScore: process.env.VISION_CRITIC_MIN_SCORE ? Number(process.env.VISION_CRITIC_MIN_SCORE) : 3,
    // T5.1: the copyScore this SAME critic call returns (pipeline/copy-critic.ts)
    // is FLAG-only — see RunDeps.copyCriticMinScore's doc — so, unlike
    // visionCriticMinScore, missing this env var below is low-stakes; it only
    // changes when the `copy_critic` RunEvent's `passed` flips, never ingest.
    copyCriticMinScore: process.env.COPY_CRITIC_MIN_SCORE ? Number(process.env.COPY_CRITIC_MIN_SCORE) : 3,
    // T5.2: the imageRelevanceScore this SAME critic call returns (pipeline/
    // vision-critic.ts) is FLAG-only — see RunDeps.imageRelevanceMinScore's doc
    // — same low-stakes default resolution as copyCriticMinScore above.
    imageRelevanceMinScore: process.env.IMAGE_RELEVANCE_MIN_SCORE ? Number(process.env.IMAGE_RELEVANCE_MIN_SCORE) : 3,
    ingest: dryRun ? async () => ({ deduped: false }) : (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 2,
    maxParseRetries: 2,
    maxBudgetUsd: maxBudget,
    // T2.2: bounded retry-with-backoff for transient_infra per-target failures.
    // Defaults (2 retries, 250ms base) match run.ts's own defaults — set
    // explicitly here so they're documented alongside the other env-tunable
    // knobs and a real run can override them without touching code.
    maxRetries: process.env.PIPELINE_RETRY_MAX ? Number(process.env.PIPELINE_RETRY_MAX) : 2,
    retryBaseDelayMs: process.env.PIPELINE_RETRY_BASE_DELAY_MS ? Number(process.env.PIPELINE_RETRY_BASE_DELAY_MS) : 250,
    onEvent,
    log,
  };
  return { deps, close: async () => { await renderer?.close(); } };
}

export interface BuildThemeDepsOptions {
  /** The pack's pinned brand name (e.g. `ThemeSpec.brief.businessName`) — used
   * ONLY to derive `packSlugPrefix` for the near-dupe pool exclusion below
   * (see `nearDuplicateHashes`'s doc). Never sent anywhere. */
  businessName: string;
  /** Log-line prefix, e.g. `[theme]`, `[radiology]`, `[steak]`. */
  logPrefix?: string;
  /** Additive instrumentation hook (T4.1) — forwarded verbatim to `ThemeDeps.onEvent`. */
  onEvent?: (event: RunEvent) => void;
  /** Per-LLM-call budget cap, same resolution order as `buildRunDeps`
   * (`PIPELINE_MAX_BUDGET_USD` env var wins, then this default). The theme
   * scripts have historically used a higher default than the matrix
   * pipeline's $1 — multi-page/long full-landing generations cost more per
   * call — so each script passes its own via this option rather than relying
   * on ONE hardcoded default here. */
  defaultMaxBudgetUsd?: number;
  /** Theme scripts give sections a bit more repair headroom than the matrix
   * pipeline (`buildRunDeps` implicitly relies on `RunDeps.maxRepairs` being
   * supplied by the caller; the theme scripts this factory replaces all used
   * 3, vs. the matrix pipeline's 2) — long multi-page landings are worth
   * another repair attempt rather than dropping a whole page over one
   * BLOCK_PARSE_ERROR. Defaults to 3 to match pre-existing behavior. */
  maxRepairs?: number;
  maxParseRetries?: number;
}

/**
 * Followups #1 — `buildThemeDeps`: the theme-script analog of `buildRunDeps`
 * above. Before this factory existed, `scripts/create-restaurant-pack.ts`,
 * `scripts/create-radiology-landing.ts` and `scripts/create-steakhouse-landing.ts`
 * each hand-assembled their own `ThemeDeps` object and, in doing so, silently
 * omitted `visionCritic`, `nearDuplicateHashes`, and `onEvent` — real gates
 * `npm run pipeline` gets "for free" via `buildRunDeps` — and their hand-rolled
 * `render` closures returned only `{ previewImageKeys, perceptualHash }`, never
 * the T2.1 render-outcome contract's `outcome`/`screenshotPaths` fields. That
 * silently miscounted a blank render as `renderFailed` (losing the distinct
 * `renderBlank` signal) and left the vision critic with no local file paths to
 * read even where one WAS wired later — the exact hole the followups #3 guard
 * (`run.ts`'s `criticPaths`) now hard-drops on instead of silently misbehaving.
 * Every theme script should now build its `ThemeDeps` via this factory instead
 * of copy-pasting the wiring (and the gap) forward.
 *
 * Reuses the same building blocks `buildRunDeps` does (`claudeCliClient`,
 * `loadGrounding`, `validateLayout`, `uploadLayout`, `realRenderDeps` +
 * `renderAndCapture` for the T2.1-compliant render closure, `resolveLayoutImages`,
 * `postIngest`, `claudeVisionCritic`) rather than a from-scratch reimplementation
 * — deliberately a SEPARATE function (not a thin wrapper around `buildRunDeps`)
 * because the two callers' shapes genuinely differ (theme: `pageExists` resume
 * support + no `targets`/dry-run; matrix: `targets` + dry-run stubs), and
 * forcing one to wrap the other would couple those two unrelated concerns.
 */
export async function buildThemeDeps(opts: BuildThemeDepsOptions): Promise<{ deps: ThemeDeps; close: () => Promise<void> }> {
  const logPrefix = opts.logPrefix ?? '[theme]';
  const log = (m: string) => console.log(`${logPrefix} ${m}`);

  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir, log);

  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3000';
  const ingestToken = process.env.INGEST_API_TOKEN ?? '';
  const maxBudget = process.env.PIPELINE_MAX_BUDGET_USD ? Number(process.env.PIPELINE_MAX_BUDGET_USD) : (opts.defaultMaxBudgetUsd ?? 1);

  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const renderer = await realRenderDeps();
  const pexelsKey = process.env.PEXELS_API_KEY;

  // T4.2/followups #1 "resume trap" (documented in the followups spec and in
  // pipeline/theme.ts:114's TODO(T4.2) comment): `runThemePack`'s
  // `createRunContext(runDeps, { growDedupePools: false })` call only stops
  // THIS run from growing/checking the in-memory near-dupe pool against pages
  // it itself just ingested — it does nothing about a PRIOR, interrupted run
  // of the SAME pack. Those earlier pages are already in the DB with a real
  // `perceptualHash` by the time a resumed run starts, and the pool is seeded
  // ONCE at `createRunContext` time (see run.ts) — if the seed query pulled
  // those rows in, the pool would already contain this pack's OWN siblings on
  // the very first `nearestDistance` check, silently reintroducing the exact
  // pixel-near-dupe drop the pack is supposed to be exempt from.
  //
  // Fix (chosen over leaving `nearDuplicateHashes` unwired for themes
  // entirely): exclude this pack's own rows from the seed query by slug
  // prefix. `themePageSlug` (pipeline/theme.ts) always builds the slug as
  // `slugify(\`${brief.businessName} ${style} ${niche} ${role} page for divi 5\`)`
  // — the brand name is the FIRST token(s) fed to `slugify`, so every page of
  // this pack shares the identical `slugify(businessName)` prefix, and no
  // other pack's brand name collides with it in practice (two packs would
  // need the exact same business name to share a prefix). Cheap: `slug` and
  // `perceptual_hash` are both plain, already-queried columns on `layouts` —
  // no extra table, join, or migration needed.
  const packSlugPrefix = `${slugify(opts.businessName)}-`;

  const deps: ThemeDeps = {
    guide,
    llm: claudeCliClient({ model: process.env.PIPELINE_MODEL }),
    validate: (json) => withTempFile(json, (f) => validateLayout(f)),
    resolveImages: pexelsKey ? (json) => resolveLayoutImages(json, pexelsSearcher(pexelsKey)) : undefined,
    isDuplicate: async (hash) => {
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.contentHash, hash)).limit(1);
      return hit.length > 0;
    },
    // Resume support (theme-only): skip any page already in the catalog so a
    // run survives a usage-limit interruption — only the missing pages cost
    // generation on a re-run.
    pageExists: async (slug) => {
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.slug, slug)).limit(1);
      return hit.length > 0;
    },
    nearDuplicateHashes: async () => {
      const rows = await db
        .select({ perceptualHash: layouts.perceptualHash })
        .from(layouts)
        .where(and(isNotNull(layouts.perceptualHash), notLike(layouts.slug, `${packSlugPrefix}%`)))
        .orderBy(desc(layouts.createdAt))
        .limit(2000);
      return rows.map((r) => r.perceptualHash).filter((h): h is string => !!h);
    },
    upload: (hash, json) => uploadLayout(hash, json, { hasBlobToken, outDir: 'pipeline/out' }),
    // Same T2.1-compliant render closure buildRunDeps wires for the matrix
    // pipeline: local temp-file screenshot paths (the vision critic's `claude
    // --allowedTools Read` call needs real files, not blob keys) plus the
    // ok/blank/error outcome contract — see renderAndCapture's doc above.
    render: (input) => renderAndCapture(input, { renderLayout, renderDeps: renderer.deps, hasBlobToken, logPrefix, log }),
    visionCritic: claudeVisionCritic({ model: process.env.VISION_CRITIC_MODEL, maxBudgetUsd: maxBudget }),
    visionCriticMinScore: process.env.VISION_CRITIC_MIN_SCORE ? Number(process.env.VISION_CRITIC_MIN_SCORE) : 3,
    copyCriticMinScore: process.env.COPY_CRITIC_MIN_SCORE ? Number(process.env.COPY_CRITIC_MIN_SCORE) : 3,
    imageRelevanceMinScore: process.env.IMAGE_RELEVANCE_MIN_SCORE ? Number(process.env.IMAGE_RELEVANCE_MIN_SCORE) : 3,
    ingest: (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: opts.maxRepairs ?? 3,
    maxParseRetries: opts.maxParseRetries ?? 2,
    maxBudgetUsd: maxBudget,
    maxRetries: process.env.PIPELINE_RETRY_MAX ? Number(process.env.PIPELINE_RETRY_MAX) : 2,
    retryBaseDelayMs: process.env.PIPELINE_RETRY_BASE_DELAY_MS ? Number(process.env.PIPELINE_RETRY_BASE_DELAY_MS) : 250,
    onEvent: opts.onEvent,
    log,
  };
  return { deps, close: async () => { await renderer.close(); } };
}
