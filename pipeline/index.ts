// Divi5Lab generation pipeline — CLI entry (generate → validate → render → ingest).
//   npm run pipeline -- drip --count=N [--dry-run]
//   npm run pipeline -- batch [--dry-run]
// A real run needs: the Docker WP+Divi env up (render), VALIDATOR_CMD set, the web
// app running (ingest, INGEST_API_TOKEN), and env sourced. Ingest auto-publishes —
// there is no `pending`/admin-review queue (see lib/ingest/status.ts); the pipeline's
// own gates (validator, vision critic, near-dupe/boilerplate checks) are the only
// quality gate before a layout goes live.
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { MATRIX, planTargets, buildVariants, buildVariantSet, type Target } from './recipes';
import { runPipeline } from './run';
import { arg, hasFlag, buildRunDeps } from './deps';

async function coveredKeys(): Promise<Set<string>> {
  const rows = await db.select({ type: layouts.type, niche: layouts.niche, style: layouts.style }).from(layouts);
  return new Set(rows.map((r) => `${r.type}|${r.niche ?? ''}|${r.style ?? ''}`));
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'batch' && mode !== 'drip' && mode !== 'vary' && mode !== 'set' && mode !== 'one') {
    console.log('Usage: npm run pipeline -- <batch|drip [--count=N]|vary [--type=] [--count=N]|set [...]|one --target=type:niche:style> [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const dryRun = hasFlag('dry-run');

  // `vary` generates many diverse variants per type (color + placement + niche + style);
  // it intentionally bypasses the type|niche|style coverage skip — content-hash dedup
  // still prevents exact repeats. `batch`/`drip` walk the curated matrix, skipping covered combos.
  let targets: Target[];
  if (mode === 'one') {
    // Regenerate/produce exactly one explicit target, bypassing the coverage skip
    // (content-hash dedup still prevents an identical repeat).
    const [type, niche, style] = (arg('target') ?? '').split(':');
    if (!type || !niche || !style) { console.error('one mode needs --target=type:niche:style'); process.exitCode = 1; return; }
    targets = [{ type, niche, style }];
  } else if (mode === 'set') {
    const base = { type: arg('type') ?? 'cards', niche: arg('niche') ?? 'saas', style: arg('style') ?? 'minimal', color: arg('color') };
    const columns = (arg('columns') ?? '2,3,4').split(',').map(Number).filter((n) => n > 0);
    const icons = (arg('icons') ?? 'top,left').split(',').map((s) => s.trim()).filter(Boolean) as ('none' | 'top' | 'left')[];
    const iconStyles = (arg('icon-styles') ?? 'circle,plain,number').split(',').map((s) => s.trim()).filter(Boolean) as ('circle' | 'plain' | 'number')[];
    targets = buildVariantSet(base, columns, icons, iconStyles);
  } else if (mode === 'vary') {
    const types = (arg('type') ?? 'hero,cta,features,pricing,testimonials,faq,contact,gallery')
      .split(',').map((s) => s.trim()).filter(Boolean);
    targets = buildVariants(types, Number(arg('count') ?? '3'));
  } else {
    const count = mode === 'drip' ? Number(arg('count') ?? '1') : undefined;
    const covered = dryRun ? new Set<string>() : await coveredKeys();
    targets = planTargets(MATRIX, covered, count);
  }

  const { deps, close } = await buildRunDeps({ targets, dryRun, logPrefix: '[pipeline]' });

  console.log(`[pipeline] ${mode}${dryRun ? ' (dry-run)' : ''} — ${targets.length} target(s)`);
  const summary = await runPipeline(deps);
  await close();
  console.log('[pipeline] summary:', summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
