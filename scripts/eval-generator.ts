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
import type { Target } from '@/pipeline/recipes';
import { runPipeline, type RunDeps, type RunEvent } from '@/pipeline/run';
import { arg, hasFlag, buildRunDeps } from '@/pipeline/deps';
import { MetricsAccumulator, formatComparisonTable, type EvalMetrics } from '@/pipeline/eval/metrics';

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

interface EvalConfigDef {
  label: string;
  /** Env vars to set for this config's run; `undefined` deletes the var. Restored
   * to whatever it was before after this config finishes. */
  env: Record<string, string | undefined>;
}

// The "off" config explicitly sets the flag to '0' rather than deleting it —
// deleting it would just mean "whatever the current default is", which silently
// stopped being a baseline the moment library exemplars (T1.1) flipped their
// default to ON. An explicit '0'/'1' pair keeps this A/B meaningful regardless
// of any flag's default. (Not unit-tested directly: importing this module runs
// `main()` at module load — see the bottom of this file — so it's exercised via
// `npx tsx scripts/eval-generator.ts --dry-run` instead; see its own header comment.)
function configsToRun(): EvalConfigDef[] {
  const envVar = arg('env-var') ?? 'USE_LIBRARY_EXEMPLARS';
  const offLabel = arg('off-label') ?? 'baseline';
  const onLabel = arg('on-label') ?? `${envVar.toLowerCase()}-on`;
  return [
    { label: offLabel, env: { [envVar]: '0' } },
    { label: onLabel, env: { [envVar]: '1' } },
  ];
}

// Wired through pipeline/deps.ts's buildRunDeps — the SAME dependency-construction
// logic `pipeline/index.ts` uses for a real `npm run pipeline` run, so this harness
// measures the real path and can never silently drift from it (T4.1 acceptance
// criterion: "wired to the same deps as run.ts").
async function buildDeps(dryRun: boolean, onEvent: (e: RunEvent) => void): Promise<{ deps: RunDeps; close: () => Promise<void> }> {
  return buildRunDeps({ targets: EVAL_TARGET_SET, dryRun, onEvent, logPrefix: '[eval]' });
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
