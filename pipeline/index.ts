// Divi5Lab generation pipeline — CLI entry (generate → validate → render → ingest).
//   npm run pipeline -- drip --count=N [--dry-run]
//   npm run pipeline -- batch [--dry-run]
// A real run needs: the Docker WP+Divi env up (render), VALIDATOR_CMD set, the web
// app running (ingest, INGEST_API_TOKEN), and env sourced. Layouts land as `pending`.
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from './llm';
import { MATRIX, planTargets, buildVariants, buildVariantSet, loadGrounding, type Target } from './recipes';
import { validateLayout } from './validate';
import { uploadLayout, uploadScreenshot } from './upload';
import { realRenderDeps, renderLayout } from './render';
import { resolveLayoutImages, pexelsSearcher } from './images';
import { postIngest } from './ingest';
import { runPipeline, type RunDeps } from './run';

async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'layout-'));
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

async function coveredKeys(): Promise<Set<string>> {
  const rows = await db.select({ type: layouts.type, niche: layouts.niche, style: layouts.style }).from(layouts);
  return new Set(rows.map((r) => `${r.type}|${r.niche ?? ''}|${r.style ?? ''}`));
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'batch' && mode !== 'drip' && mode !== 'vary' && mode !== 'set') {
    console.log('Usage: npm run pipeline -- <batch|drip [--count=N]|vary [--type=] [--count=N]|set [--type= --niche= --style= --columns=2,3,4 --icons=none,top,left]> [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const dryRun = hasFlag('dry-run');

  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir);

  // `vary` generates many diverse variants per type (color + placement + niche + style);
  // it intentionally bypasses the type|niche|style coverage skip — content-hash dedup
  // still prevents exact repeats. `batch`/`drip` walk the curated matrix, skipping covered combos.
  let targets: Target[];
  if (mode === 'set') {
    const base = { type: arg('type') ?? 'features', niche: arg('niche') ?? 'saas', style: arg('style') ?? 'minimal', color: arg('color') };
    const columns = (arg('columns') ?? '2,3,4').split(',').map(Number).filter((n) => n > 0);
    const icons = (arg('icons') ?? 'none,top,left').split(',').map((s) => s.trim()).filter(Boolean) as ('none' | 'top' | 'left')[];
    targets = buildVariantSet(base, columns, icons);
  } else if (mode === 'vary') {
    const types = (arg('type') ?? 'hero,cta,features,pricing,testimonials,faq,contact,gallery')
      .split(',').map((s) => s.trim()).filter(Boolean);
    targets = buildVariants(types, Number(arg('count') ?? '3'));
  } else {
    const count = mode === 'drip' ? Number(arg('count') ?? '1') : undefined;
    const covered = dryRun ? new Set<string>() : await coveredKeys();
    targets = planTargets(MATRIX, covered, count);
  }

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
    llm: dryRun ? stubLlm : claudeCliClient(),
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
            console.warn(`[pipeline] render failed for ${hash.slice(0, 12)}: ${(e as Error).message}`);
            return { previewImageKeys: [] };
          }
        }
      : undefined,
    ingest: dryRun ? async () => ({ deduped: false }) : (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 2,
    maxBudgetUsd: maxBudget,
    log: (m) => console.log(`[pipeline] ${m}`),
  };

  console.log(`[pipeline] ${mode}${dryRun ? ' (dry-run)' : ''} — ${targets.length} target(s)`);
  const summary = await runPipeline(deps);
  await renderer?.close();
  console.log('[pipeline] summary:', summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
