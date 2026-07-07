// scripts/eval-generator.ts — T4.1 generation eval harness.
//
// Runs a FIXED, deterministic target set through the real pipeline (`runPipeline`
// from pipeline/run.ts) twice, once per A/B config, and prints a side-by-side
// scoreboard: validator pass-rate, mean repair attempts, content-lint hit-rate,
// tokens/cost per accepted layout, and drop reasons by class. The A/B knob
// defaults to USE_LIBRARY_EXEMPLARS on/off but is generic — pass --env-var to
// compare any other env-config flag the same way.
//
// Usage:
//   npx tsx scripts/eval-generator.ts
//   npx tsx scripts/eval-generator.ts --dry-run
//   npx tsx scripts/eval-generator.ts --env-var=USE_LIBRARY_EXEMPLARS --off-label=baseline --on-label=exemplars
//
// A REAL (non-dry-run) run wires the SAME deps as `npm run pipeline` — it shells
// out to `claude`, the deterministic validator, Pexels, the local render Docker
// env, and POSTs to the ingest API. It spends real LLM budget and (ingest
// currently auto-publishes — see lib/ingest/status.ts) lands accepted layouts in
// the catalog, same as any other pipeline run. Content-hash dedupe still prevents
// re-running the harness from duplicating anything already ingested.
//
// Use --dry-run to smoke-test the harness's own plumbing (stubbed llm/validate/
// ingest, matching `npm run pipeline -- <mode> --dry-run` semantics) without
// spending budget or touching the catalog.
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from '@/pipeline/llm';
import { loadGrounding, type Target } from '@/pipeline/recipes';
import { validateLayout } from '@/pipeline/validate';
import { uploadLayout, uploadScreenshot } from '@/pipeline/upload';
import { realRenderDeps, renderLayout } from '@/pipeline/render';
import { resolveLayoutImages, pexelsSearcher } from '@/pipeline/images';
import { postIngest } from '@/pipeline/ingest';
import { runPipeline, type RunDeps, type RunEvent } from '@/pipeline/run';
import { MetricsAccumulator, formatComparisonTable, type EvalMetrics } from '@/pipeline/eval/metrics';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Fixed, deterministic target set. Small enough to bound cost/time per config,
// diverse enough (four section types, four niches/styles) to be informative.
// Change this list deliberately — A/B and before/after comparisons are only
// meaningful if the target set is stable across runs.
export const EVAL_TARGET_SET: Target[] = [
  { type: 'hero', niche: 'saas', style: 'minimal' },
  { type: 'cta', niche: 'agency', style: 'bold' },
  { type: 'pricing', niche: 'fitness', style: 'dark' },
  { type: 'features', niche: 'coaching', style: 'elegant' },
];

async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'eval-layout-'));
  const file = join(dir, 'layout.json');
  await writeFile(file, json);
  try {
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

interface EvalConfigDef {
  label: string;
  /** Env vars to set for this config's run; `undefined` deletes the var. Restored
   * to whatever it was before after this config finishes. */
  env: Record<string, string | undefined>;
}

function configsToRun(): EvalConfigDef[] {
  const envVar = arg('env-var') ?? 'USE_LIBRARY_EXEMPLARS';
  const offLabel = arg('off-label') ?? 'baseline';
  const onLabel = arg('on-label') ?? `${envVar.toLowerCase()}-on`;
  return [
    { label: offLabel, env: { [envVar]: undefined } },
    { label: onLabel, env: { [envVar]: '1' } },
  ];
}

async function buildDeps(dryRun: boolean, onEvent: (e: RunEvent) => void): Promise<{ deps: RunDeps; close: () => Promise<void> }> {
  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir);
  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3000';
  const ingestToken = process.env.INGEST_API_TOKEN ?? '';
  const maxBudget = process.env.PIPELINE_MAX_BUDGET_USD ? Number(process.env.PIPELINE_MAX_BUDGET_USD) : 1;
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const renderer = dryRun ? null : await realRenderDeps();
  const pexelsKey = process.env.PEXELS_API_KEY;
  const stubLlm = { complete: async () => '{"content":[]}' };

  const deps: RunDeps = {
    targets: EVAL_TARGET_SET,
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
            console.warn(`[eval] render failed: ${(e as Error).message}`);
            return { previewImageKeys: [] };
          }
        }
      : undefined,
    ingest: dryRun ? async () => ({ deduped: false }) : (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 2,
    maxParseRetries: 2,
    maxBudgetUsd: maxBudget,
    onEvent,
    log: (m) => console.log(`[eval] ${m}`),
  };
  return { deps, close: async () => { await renderer?.close(); } };
}

async function runOneConfig(cfg: EvalConfigDef, dryRun: boolean): Promise<EvalMetrics> {
  const prevEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(cfg.env)) {
    prevEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const acc = new MetricsAccumulator(cfg.label, EVAL_TARGET_SET.length);
    const { deps, close } = await buildDeps(dryRun, (e) => acc.add(e));
    console.log(`[eval] running config "${cfg.label}" (${EVAL_TARGET_SET.length} targets)${dryRun ? ' [dry-run]' : ''}`);
    const summary = await runPipeline(deps);
    await close();
    console.log(`[eval] config "${cfg.label}" summary:`, summary);
    return acc.finalize(summary);
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const configs = configsToRun();
  const results: EvalMetrics[] = [];
  for (const cfg of configs) {
    results.push(await runOneConfig(cfg, dryRun));
  }
  console.log('\n' + formatComparisonTable(results));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
