// Ingest a batch of free hero sections composed by the AI Editor for Divi 5 plugin's hero recipes (validator repo):
//   php scripts/theme-packs/build-heroes.php        -> dist/heroes/<slug>.json
// Each hero runs through every downstream gate here (validate, stock photos, design lint, mobile stacking, dedupe,
// SEO, real Divi render, critics, ingest) exactly like a generated layout, with the slug/title/axes pinned.
//
//   npm run dev            # in another shell (ingest target)
//   set -a && . ./.env.local && set +a && HERO_DIR=<dir with the json files> HERO_META=<heroes-meta.json> npx tsx scripts/create-heroes.ts
// Optional: HERO_RANGE=0-6 (inclusive indexes) to split a batch across workers.
import { readFileSync } from 'node:fs';
import { buildThemeDeps } from '@/pipeline/deps';
import { createRunContext, processItem, type RunDeps } from '@/pipeline/run';

interface HeroMeta { slug: string; title: string; niche: string; style: string; color: string }

const DIR = process.env.HERO_DIR ?? '../Divi 5 Deterministic Validator/dist/heroes';
const META = JSON.parse(readFileSync(process.env.HERO_META ?? `${DIR}/meta.json`, 'utf8')) as HeroMeta[];
const [from, to] = (process.env.HERO_RANGE ?? `0-${META.length - 1}`).split('-').map(Number);

async function main() {
  const { deps, close } = await buildThemeDeps({ businessName: 'free-hero-batch', logPrefix: '[hero]', defaultMaxBudgetUsd: 1 });
  const runDeps: RunDeps = { ...deps, targets: [] };
  const ctx = await createRunContext(runDeps, { growDedupePools: true });
  const tally: Record<string, number> = {};
  for (const h of META.slice(from, to + 1)) {
    if (deps.pageExists && (await deps.pageExists(h.slug))) { console.log(`[hero] skip existing ${h.slug}`); tally.existing = (tally.existing ?? 0) + 1; continue; }
    const precomposed = readFileSync(`${DIR}/${h.slug}.json`, 'utf8');
    const { outcome, abort } = await processItem(
      {
        target: { type: 'hero', niche: h.niche, style: h.style, color: h.color },
        precomposed,
        pins: { slug: h.slug, title: h.title, type: 'hero', niche: h.niche, style: h.style, color: h.color },
      },
      ctx,
    );
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    console.log(`[hero] ${outcome}: ${h.slug}`);
    if (abort) { console.log('[hero] aborting remaining heroes'); break; }
  }
  await close();
  console.log('[hero] summary:', tally);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
