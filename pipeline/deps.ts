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
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from './llm';
import { loadGrounding, type Target } from './recipes';
import { validateLayout } from './validate';
import { uploadLayout, uploadScreenshot } from './upload';
import { realRenderDeps, renderLayout } from './render';
import { resolveLayoutImages, pexelsSearcher } from './images';
import { postIngest } from './ingest';
import type { RunDeps, RunEvent } from './run';

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

  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir);

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
    upload: (hash, json) => uploadLayout(hash, json, { hasBlobToken, outDir: 'pipeline/out' }),
    render: renderer
      ? async ({ title, postContent, hash }) => {
          try {
            const { shots, perceptualHash } = await renderLayout({ title, postContent }, renderer.deps);
            const keys: string[] = [];
            for (const label of ['desktop', 'mobile'] as const) {
              const shot = shots.find((s) => s.label === label);
              if (shot) keys.push(await uploadScreenshot(hash, label, shot.buffer, { hasBlobToken }));
            }
            return { previewImageKeys: keys, perceptualHash };
          } catch (e) {
            console.warn(`${logPrefix} render failed for ${hash.slice(0, 12)}: ${(e as Error).message}`);
            return { previewImageKeys: [] };
          }
        }
      : undefined,
    ingest: dryRun ? async () => ({ deduped: false }) : (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 2,
    maxParseRetries: 2,
    maxBudgetUsd: maxBudget,
    onEvent,
    log: (m) => console.log(`${logPrefix} ${m}`),
  };
  return { deps, close: async () => { await renderer?.close(); } };
}
