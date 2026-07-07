// tests/pipeline-orchestrator.test.ts
//
// T4.2: run.ts (matrix/vary) and theme.ts (multi-page themes) now share ONE
// per-layout gate pipeline (`processItem` + `createRunContext` in run.ts). These
// tests assert the SAME gates fire for BOTH entry configs — a matrix Target and a
// theme page config — so a gate added in one place applies to both. They also pin
// the theme-specific behavior CHANGES this unification introduces (render-miss is
// now a DROP, not a placeholder-preview ingest) and the theme near-dupe
// adjudication (within-pack pages are never dropped against each other).
import { describe, it, expect, vi } from 'vitest';
import { runPipeline, type RunEvent } from '@/pipeline/run';
import { runThemePack, themePageSlug, themePageTitle, type ThemeSpec, type ThemePage, type ThemeDeps } from '@/pipeline/theme';
import type { Brief } from '@/pipeline/compose';

const guide = { style: 's', schema: 'sc', examples: [] };
const ok = { valid: true, violations: [] };

// A floor-passing SEO response (metaDescription long enough, >=3 keywords) so the
// SEO quality-floor gate never adds a retry these tests aren't about.
const seoJson = JSON.stringify({
  title: 'T',
  slug: 's',
  metaDescription: 'A clean, conversion-focused landing page built for real marketing teams shipping fast.',
  keywords: ['restaurant', 'elegant', 'landing'],
  axes: { type: 'full_landing', niche: 'restaurant', style: 'elegant', colors: [] },
});

// One valid Divi section (no lorem/placeholder copy so the content gate passes).
const section = (n = 1) =>
  JSON.stringify({
    post_title: `S${n}`,
    post_content: `<!-- wp:divi/section --> Ship faster with real, specific copy number ${n} <!-- /wp:divi/section -->`,
  });

// LLM mock: a section per generateLayout call, seoJson for the SEO call. Theme
// pins its brief, so composeLanding never makes a brief call.
function themeLlm(seo = seoJson) {
  let n = 0;
  return {
    complete: vi.fn(async ({ prompt }: { prompt: string }) =>
      prompt.startsWith('Generate a Divi 5') ? section(n++) : seo,
    ),
  };
}

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
const flow = [
  { role: 'hero', sectionType: 'hero', job: 'welcome', cta: true },
  { role: 'final_cta', sectionType: 'cta', job: 'close', cta: true },
];
const home: ThemePage = { role: 'home', roleLabel: 'Home', flow };
const menu: ThemePage = { role: 'menu', roleLabel: 'Menu', flow };
const spec: ThemeSpec = { niche: 'restaurant', style: 'elegant', color: 'warm', brief, brandFacts: 'Name: Bella Nota.', pages: [home] };

function themeDeps(over: Partial<ThemeDeps> = {}): ThemeDeps {
  return {
    llm: themeLlm(),
    guide: guide as any,
    validate: vi.fn(async () => ok),
    isDuplicate: vi.fn(async () => false),
    upload: vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['placeholder'] })),
    ingest: vi.fn(async () => ({ deduped: false })),
    maxRepairs: 2,
    ...over,
  } as ThemeDeps;
}

const HASH = 'a'.repeat(64);

describe('T4.2 shared orchestrator — theme path goes through run.ts gates', () => {
  it('theme happy path: composes → validates → renders → ingests, with pinned slug/title/axes', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const render = vi.fn(async () => ({ previewImageKeys: ['real'], perceptualHash: HASH }));
    const result = await runThemePack(spec, themeDeps({ ingest, render }));
    expect(result.generated).toBe(1);
    expect(result.ingested).toBe(1);
    expect(result.pageSlugs).toEqual([themePageSlug(brief, spec, home)]);
    expect(ingest).toHaveBeenCalledOnce();
    const payload = (ingest.mock.calls[0] as any)[0];
    expect(payload.slug).toBe(themePageSlug(brief, spec, home));
    expect(payload.title).toBe(themePageTitle(brief, spec, home));
    expect(payload.type).toBe('full_landing');
    expect(payload.niche).toBe('restaurant');
    expect(payload.style).toBe('elegant');
    expect(payload.previewImageKeys).toEqual(['real']); // real render previews, not the upload placeholders
    expect(payload.colors[0]).toBe('warm'); // pinned lead color
  });

  // THE behavior change (was TODO(T4.2) in theme.ts): on a render miss the theme
  // path previously kept the upload placeholders and ingested unconditionally.
  // Now the shared render-miss gate DROPS it — no ingest.
  it('theme render-miss is now a DROP (not a placeholder-preview ingest)', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const render = vi.fn(async () => ({ previewImageKeys: [] })); // wired renderer, no real previews
    const result = await runThemePack(spec, themeDeps({ ingest, render }));
    expect(result.ingested).toBe(0);
    expect(result.dropped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('theme render-blank is a DROP too (confirmed-blank verdict)', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const render = vi.fn(async () => ({ previewImageKeys: [], outcome: 'blank' as const }));
    const result = await runThemePack(spec, themeDeps({ ingest, render }));
    expect(result.ingested).toBe(0);
    expect(result.dropped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  // The vision-critic gate (T1.3) now applies to theme runs too.
  it('theme vision-critic gate drops a low-scoring page', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const render = vi.fn(async () => ({ previewImageKeys: ['real'], perceptualHash: HASH, screenshotPaths: ['/tmp/d.png'] }));
    const visionCritic = vi.fn(async () => ({ score: 2, issues: ['overlapping text'] }));
    const result = await runThemePack(spec, themeDeps({ ingest, render, visionCritic }));
    expect(visionCritic).toHaveBeenCalledOnce();
    expect(result.ingested).toBe(0);
    expect(result.dropped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('theme SEO/error events surface through the shared onEvent feed', async () => {
    const events: RunEvent[] = [];
    const render = vi.fn(async () => ({ previewImageKeys: ['real'], perceptualHash: HASH }));
    await runThemePack(spec, themeDeps({ render, onEvent: (e) => events.push(e) }));
    // The shared orchestrator emits the same generated → ingested → llm_usage feed.
    expect(events.some((e) => e.type === 'generated')).toBe(true);
    expect(events.some((e) => e.type === 'ingested')).toBe(true);
  });
});

describe('T4.2 near-dupe adjudication — within-pack theme pages are NOT dropped against each other', () => {
  it('two same-palette pages of one pack both ingest even with identical perceptual hashes', async () => {
    const twoPage: ThemeSpec = { ...spec, pages: [home, menu] };
    const ingest = vi.fn(async () => ({ deduped: false }));
    // Same perceptual hash for BOTH pages (shared header/footer bands + palette).
    const render = vi.fn(async () => ({ previewImageKeys: ['real'], perceptualHash: HASH }));
    const result = await runThemePack(twoPage, themeDeps({ ingest, render, llm: themeLlm() }));
    expect(result.ingested).toBe(2); // within-pack similarity must NOT drop the sibling
    expect(result.dropped).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('a theme page that near-duplicates an EXISTING catalog layout still drops', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const render = vi.fn(async () => ({ previewImageKeys: ['real'], perceptualHash: HASH }));
    const nearDuplicateHashes = vi.fn(async () => [HASH]); // the DB already holds this look
    const result = await runThemePack(spec, themeDeps({ ingest, render, nearDuplicateHashes }));
    expect(nearDuplicateHashes).toHaveBeenCalledOnce(); // seeded once per run, not per page
    expect(result.ingested).toBe(0);
    expect(result.dropped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe('T4.2 theme behavior preserved through the shared orchestrator', () => {
  it('pageExists resume: skips generation entirely but keeps the slug in the pack', async () => {
    const llm = themeLlm();
    const ingest = vi.fn(async () => ({ deduped: false }));
    const result = await runThemePack(spec, themeDeps({ llm, ingest, pageExists: vi.fn(async () => true) }));
    expect(result.generated).toBe(0);
    expect(result.ingested).toBe(0);
    expect(result.pageSlugs).toEqual([themePageSlug(brief, spec, home)]);
    expect(llm.complete).not.toHaveBeenCalled(); // zero LLM spend on a resumed page
    expect(ingest).not.toHaveBeenCalled();
  });

  it('exact content-hash dedupe still records the page slug for pack assembly', async () => {
    const result = await runThemePack(spec, themeDeps({ isDuplicate: vi.fn(async () => true) }));
    expect(result.deduped).toBe(1);
    expect(result.ingested).toBe(0);
    expect(result.pageSlugs).toEqual([themePageSlug(brief, spec, home)]);
  });

  it('a usage-limit error aborts the remaining pages of the theme run (shared error classification)', async () => {
    const twoPage: ThemeSpec = { ...spec, pages: [home, menu] };
    const llm = { complete: vi.fn(async () => 'You have hit your limit for this session, please try again later') };
    const ingest = vi.fn(async () => ({ deduped: false }));
    const result = await runThemePack(twoPage, themeDeps({ llm, ingest }));
    expect(result.dropped).toBe(1); // page 1 errored (bucketed into dropped for back-compat)
    expect(result.ingested).toBe(0);
    // Page 2 was never attempted — only page 1's single (failed) generate call happened.
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe('T4.2 gate parity — the render gate fires identically for matrix and theme configs', () => {
  const matrixTarget = { type: 'hero', niche: 'saas', style: 'minimal' };
  const matrixSeo = JSON.stringify({
    title: 'T',
    slug: 's',
    metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.',
    keywords: ['hero', 'saas', 'minimal'],
    axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] },
  });

  it('a wired renderer with no real previews drops in BOTH paths (never ingests)', async () => {
    // Matrix path
    const matrixIngest = vi.fn(async () => ({ deduped: false }));
    const matrixLlm = { complete: vi.fn().mockResolvedValueOnce(section()).mockResolvedValueOnce(matrixSeo) };
    const ms = await runPipeline({
      targets: [matrixTarget],
      guide,
      llm: matrixLlm,
      validate: vi.fn(async () => ok),
      isDuplicate: vi.fn(async () => false),
      upload: vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['placeholder'] })),
      render: vi.fn(async () => ({ previewImageKeys: [] })),
      ingest: matrixIngest,
      maxRepairs: 2,
    } as any);
    expect(ms.renderFailed).toBe(1);
    expect(ms.ingested).toBe(0);
    expect(matrixIngest).not.toHaveBeenCalled();

    // Theme path — same failing render dep, same terminal fate
    const themeIngest = vi.fn(async () => ({ deduped: false }));
    const tr = await runThemePack(spec, themeDeps({ ingest: themeIngest, render: vi.fn(async () => ({ previewImageKeys: [] })) }));
    expect(tr.ingested).toBe(0);
    expect(themeIngest).not.toHaveBeenCalled();
  });
});
