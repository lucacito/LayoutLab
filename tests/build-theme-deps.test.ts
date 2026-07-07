// tests/build-theme-deps.test.ts
//
// Followups #1: `buildThemeDeps` (pipeline/deps.ts) is the theme-script analog
// of `buildRunDeps` — before it existed, `scripts/create-restaurant-pack.ts`,
// `scripts/create-radiology-landing.ts` and `scripts/create-steakhouse-landing.ts`
// each hand-assembled their own `ThemeDeps` and, in doing so, silently omitted
// `visionCritic`, `nearDuplicateHashes`, and `onEvent`, and their hand-rolled
// `render` closures never populated the T2.1 render-outcome contract
// (`outcome`/`screenshotPaths`). These tests mock every TRUE I/O boundary (the
// DB, the `claude` CLI, the validator CLI, Blob upload, the ingest HTTP call,
// the renderer) while keeping the REAL pipeline logic (generateLayout,
// composeLanding, run.ts's processItem/createRunContext, theme.ts's
// runThemePack) — a characterization of the factory's wiring, not a
// mock-everything unit test.
import { describe, it, expect, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';

const { dbChain } = vi.hoisted(() => {
  const chain: any = {};
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    chain.lastWhere = cond;
    return chain;
  };
  chain.orderBy = () => chain;
  // "not found" / "no existing hashes" for every pageExists/isDuplicate/
  // nearDuplicateHashes query below — these tests are about WIRING, not the
  // near-dupe distance math itself (already covered by pipeline-run.test.ts /
  // pipeline-orchestrator.test.ts).
  chain.limit = () => Promise.resolve([]);
  return { dbChain: chain };
});

vi.mock('@/db/client', () => ({ db: { select: vi.fn(() => dbChain) } }));

// Partial mock: keep every real drizzle-orm export, but spy on `notLike` so we
// can assert the near-dupe seed query actually excludes this pack's own rows
// (the T4.2 "resume trap" fix) without needing a real Postgres to inspect SQL.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, notLike: vi.fn(actual.notLike) };
});

// loadGrounding reads real files from the sibling validator repo — stub it so
// this test never depends on that repo being checked out, while keeping every
// other real recipes export (buildGenerationPrompt et al — generateLayout
// calls these for real on every section).
vi.mock('@/pipeline/recipes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pipeline/recipes')>();
  return { ...actual, loadGrounding: vi.fn(() => ({ style: 's', schema: 'sc', examples: [] })) };
});

const section = (n: number) =>
  JSON.stringify({
    post_title: `S${n}`,
    post_content: `<!-- wp:divi/section --> Ship faster with real, specific copy number ${n} <!-- /wp:divi/section -->`,
  });
const seoJson = JSON.stringify({
  title: 'T',
  slug: 's',
  metaDescription: 'A clean, conversion-focused landing page built for real marketing teams shipping fast.',
  keywords: ['restaurant', 'elegant', 'landing'],
  axes: { type: 'full_landing', niche: 'restaurant', style: 'elegant', colors: [] },
});

// Stub the `claude` CLI client (constraint #1 says never bypass the CLI in
// production code — this test just never spawns the REAL process). Keeps
// extractJson/LlmError real (generateLayout calls extractJson on every
// response).
vi.mock('@/pipeline/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pipeline/llm')>();
  return {
    ...actual,
    claudeCliClient: vi.fn(() => {
      let n = 0;
      return {
        complete: vi.fn(async ({ prompt }: { prompt: string }) => (prompt.startsWith('Generate a Divi 5') ? section(++n) : seoJson)),
      };
    }),
  };
});

vi.mock('@/pipeline/validate', () => ({ validateLayout: vi.fn(async () => ({ valid: true, violations: [] })) }));

vi.mock('@/pipeline/upload', () => ({
  uploadLayout: vi.fn(async (hash: string) => ({ diviJsonBlobKey: `k-${hash}`, previewImageKeys: ['placeholder'] })),
  uploadScreenshot: vi.fn(async (_hash: string, label: string) => `key-${label}`),
}));

vi.mock('@/pipeline/ingest', () => ({ postIngest: vi.fn(async () => ({ deduped: false })) }));

const HASH = 'a'.repeat(64);
vi.mock('@/pipeline/render', () => ({
  realRenderDeps: vi.fn(async () => ({ deps: {} as any, close: vi.fn(async () => {}) })),
  renderLayout: vi.fn(async () => ({
    outcome: 'ok' as const,
    shots: [
      { label: 'desktop' as const, width: 1440, buffer: Buffer.from('d') },
      { label: 'mobile' as const, width: 375, buffer: Buffer.from('m') },
    ],
    perceptualHash: HASH,
  })),
}));

// Keep meetsQualityBar/meetsImageRelevanceBar real (run.ts calls these for
// real in Phase B) — only stub the CLI-backed factory.
vi.mock('@/pipeline/vision-critic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pipeline/vision-critic')>();
  return { ...actual, claudeVisionCritic: vi.fn(() => vi.fn(async () => ({ score: 4, issues: [] }))) };
});

import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';
import { layouts } from '@/db/schema';
import { notLike } from 'drizzle-orm';
import { claudeVisionCritic } from '@/pipeline/vision-critic';

const brief: Brief = {
  businessType: 'restaurant',
  businessName: 'Bella Nota',
  tagline: 'Wood-fired Italian, made by hand',
  audience: 'locals who want a warm night out',
  conversionGoal: 'book a table',
  primaryCta: 'Reserve a Table',
  accentColorHex: '#B4472E',
  voice: 'warm',
};
const flow: Step[] = [
  { role: 'hero', sectionType: 'hero', job: 'welcome', cta: true },
  { role: 'final_cta', sectionType: 'cta', job: 'close', cta: true },
];
const home: ThemePage = { role: 'home', roleLabel: 'Home', flow };
const spec: ThemeSpec = { niche: 'restaurant', style: 'elegant', color: 'warm', brief, brandFacts: 'Name: Bella Nota.', pages: [home] };

describe('buildThemeDeps (followups #1) — shape/wiring', () => {
  it('wires visionCritic, onEvent, render, nearDuplicateHashes, and pageExists onto the returned ThemeDeps', async () => {
    const onEvent = vi.fn();
    const { deps, close } = await buildThemeDeps({ businessName: brief.businessName, onEvent });
    expect(typeof deps.visionCritic).toBe('function');
    expect(deps.onEvent).toBe(onEvent);
    expect(typeof deps.render).toBe('function');
    expect(typeof deps.nearDuplicateHashes).toBe('function');
    expect(typeof deps.pageExists).toBe('function');
    // Theme scripts historically used more repair headroom than the matrix
    // pipeline (3 vs. 2) — the factory preserves that as its default.
    expect(deps.maxRepairs).toBe(3);
    expect(deps.maxParseRetries).toBe(2);
    await close();
  });

  it("nearDuplicateHashes excludes this pack's own rows by slug prefix (the T4.2 resume-trap fix)", async () => {
    const { deps } = await buildThemeDeps({ businessName: 'Bella Nota' });
    await deps.nearDuplicateHashes!();
    expect(notLike).toHaveBeenCalledWith(layouts.slug, 'bella-nota-%');
  });

  it('the render function honors the T2.1 outcome contract (screenshotPaths + outcome), not just previewImageKeys', async () => {
    const { deps } = await buildThemeDeps({ businessName: 'Bella Nota' });
    const result = await deps.render!({ title: 'T', postContent: '<p>x</p>', hash: HASH });
    expect(result.outcome).toBe('ok');
    expect(result.previewImageKeys).toEqual(['key-desktop', 'key-mobile']);
    expect(result.screenshotPaths?.length).toBe(2); // real local temp file paths, not blob keys
    if (result.screenshotPaths?.length) await rm(dirname(result.screenshotPaths[0]), { recursive: true, force: true }).catch(() => {});
  });
});

describe('buildThemeDeps + runThemePack (followups #1) — real wiring fires the critic and seeds the near-dupe pool', () => {
  it('a theme page built through buildThemeDeps is scored by the vision critic, ingests, and seeds nearDuplicateHashes excluding its own pack', async () => {
    const { deps } = await buildThemeDeps({ businessName: brief.businessName });
    const result = await runThemePack(spec, deps);
    expect(result.ingested).toBe(1);
    const criticFn = (claudeVisionCritic as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(criticFn).toHaveBeenCalledOnce();
    expect(notLike).toHaveBeenCalledWith(layouts.slug, 'bella-nota-%');
  });
});
