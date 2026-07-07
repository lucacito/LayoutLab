// tests/pipeline-run.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPipeline, type RunEvent } from '@/pipeline/run';

const guide = { style: 's', schema: 'sc', examples: [] };
const target = { type: 'hero', niche: 'saas', style: 'minimal' };
const ok = { valid: true, violations: [] };
const bad = { valid: false, violations: [{ code: 'E_X', message: 'm', path: 'p' }] };

function baseDeps(over: Partial<any> = {}) {
  return {
    targets: [target],
    guide,
    llm: { complete: vi.fn(async () => '{"content":[]}') },
    validate: vi.fn(async () => ok),
    isDuplicate: vi.fn(async () => false),
    upload: vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['p'] })),
    ingest: vi.fn(async () => ({ deduped: false })),
    maxRepairs: 2,
    ...over,
  };
}

// A minimal seo() response shared by the near-dupe tests below (generateSeo is
// invoked with the metered llm — its mock must return this JSON).
const seoJson = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.', keywords: ['hero', 'saas', 'minimal'], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });

function renderReturning(perceptualHash: string | undefined) {
  return vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash }));
}

describe('runPipeline', () => {
  it('happy path: generate → validate → upload → ingest, summary counts 1 ingested', async () => {
    const deps = baseDeps();
    const s = await runPipeline(deps as any);
    expect(s).toMatchObject({ generated: 1, qualityDropped: 0, errored: 0, deduped: 0, ingested: 1, renderFailed: 0 });
    expect(deps.ingest).toHaveBeenCalledOnce();
  });

  it('repairs once when first validation fails then passes', async () => {
    const validate = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(ok);
    // T2.4: the 3rd (SEO) call must be a floor-passing response (`seoJson`) —
    // otherwise the new quality-floor gate retries it, adding a 4th call this
    // test isn't about.
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('{"content":[]}') // generate
      .mockResolvedValueOnce('{"content":[]}') // repair
      .mockResolvedValueOnce(seoJson) };       // seo
    const s = await runPipeline(baseDeps({ validate, llm }) as any);
    expect(s.repaired).toBe(1);
    expect(s.ingested).toBe(1);
    expect(llm.complete).toHaveBeenCalledTimes(3); // generate + repair + seo
  });

  it('drops a layout that never validates and never ingests it', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ validate: vi.fn(async () => bad), ingest }) as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('skips a duplicate before SEO/upload/ingest', async () => {
    const upload = vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ isDuplicate: vi.fn(async () => true), upload, ingest }) as any);
    expect(s.deduped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('content gate: repairs placeholder copy then ingests the cleaned layout', async () => {
    const dirty = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/text {"content":"Lorem ipsum dolor sit amet"} -->' });
    const clean = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/text {"content":"Ship faster with real copy"} -->' });
    const seo = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.', keywords: ['hero', 'saas', 'minimal'], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce(dirty)   // generate
      .mockResolvedValueOnce(clean)   // content repair
      .mockResolvedValueOnce(seo) };  // seo
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.repaired).toBe(1);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('content gate: drops a layout whose placeholder copy never gets cleaned', async () => {
    const dirty = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/text {"content":"Your content goes here"} -->' });
    const llm = { complete: vi.fn(async () => dirty) }; // generate + every repair stay dirty
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, ingest }) as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('content gate: does NOT drop clean copy that only has an unresolved placeholder image (best-effort)', async () => {
    const clean = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/image {"src":"https://loremflickr.com/800/600/saas"} -->Real specific headline here' });
    const seo = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.', keywords: ['hero', 'saas', 'minimal'], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });
    const llm = { complete: vi.fn().mockResolvedValueOnce(clean).mockResolvedValueOnce(seo) };
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.repaired).toBe(0); // image miss must not trigger a copy repair
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('routes a full_landing target through composeLanding (assembles many sections, not one-shot)', async () => {
    const brief = { businessType: 'course/coaching', businessName: 'Acme Coaching', tagline: 't', audience: 'a', conversionGoal: 'book a call', primaryCta: 'Book a Call', accentColorHex: '#E4572E', voice: 'warm' };
    const section = (n: number) => JSON.stringify({ post_title: `S${n}`, post_content: `<!-- wp:divi/placeholder --><!-- wp:divi/section {"i":${n}} -->x<!-- /wp:divi/section --><!-- /wp:divi/placeholder -->` });
    let n = 0;
    // brief, then a section per generateLayout call, then SEO — sniff by prompt content.
    const llm = { complete: vi.fn(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('landing-page brief')) return JSON.stringify(brief);
      if (prompt.startsWith('Generate a Divi 5')) return section(n++);
      return JSON.stringify({ title: 'T', slug: 's', metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.', keywords: ['hero', 'saas', 'minimal'], axes: { type: 'full_landing', niche: 'coaching', style: 'elegant', colors: [] } });
    }) };
    // Capture the JSON handed to upload — that's the assembled document.
    const upload = vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['p'] }));
    const s = await runPipeline(baseDeps({
      targets: [{ type: 'full_landing', niche: 'coaching', style: 'elegant' }],
      llm, upload,
    }) as any);
    expect(s.ingested).toBe(1);
    const uploadedJson = (upload.mock.calls[0] as any)[1] as string;
    const post = JSON.parse(uploadedJson).post_content as string;
    // Composed → the full course/coaching flow (>=6 steps) assembled under ONE wrapper.
    // A one-shot path would upload a single-section document (this assertion would fail).
    expect((post.match(/wp:divi\/placeholder -->/g) || []).length).toBe(2);
    expect((post.match(/wp:divi\/section {/g) || []).length).toBeGreaterThanOrEqual(6);
  });
});

// T1.2: near-duplicate detection via the rendered perceptual hash.
describe('runPipeline near-duplicate gate (T1.2)', () => {
  const target2 = { type: 'hero', niche: 'saas', style: 'bold' };
  const HASH_A = 'a'.repeat(64);
  const HASH_FAR = '0'.repeat(64);

  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }
  // T5.1 note: these two must be genuinely DIFFERENT prose (not just a trailing
  // digit swapped) — this describe block is testing PIXEL/perceptual-hash
  // near-duplicate detection, decoupled from the new deterministic TEXT-overlap
  // boilerplate gate (pipeline/copy-critic.ts) added in T5.1. Two near-identical
  // sentences differing only by one word/number would (correctly) trip THAT
  // gate too, which isn't what any test in this block is about.
  const GEN_TEXT: Record<number, string> = {
    1: 'Same-day emergency plumbing for Austin homeowners, licensed and insured',
    2: 'Boutique bridal photography across the Hill Country, booking weekends now',
  };
  function genJson(n: number) {
    const text = GEN_TEXT[n] ?? `Distinct unrelated filler copy variant number ${n} for testing`;
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"${text}"} -->` });
  }

  it('drops the second of two visually-identical-but-reworded layouts within the same run (in-memory pool)', async () => {
    const llm = llmSeq(genJson(1), seoJson, genJson(2), seoJson);
    const render = renderReturning(HASH_A); // same perceptual hash both times
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ targets: [target, target2], llm, render, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.nearDuped).toBe(1);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('does NOT drop genuinely different layouts even when both render successfully', async () => {
    const renders = [HASH_A, HASH_FAR];
    let i = 0;
    const render = vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash: renders[i++] }));
    const llm = llmSeq(genJson(1), seoJson, genJson(2), seoJson);
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ targets: [target, target2], llm, render, ingest }) as any);
    expect(s.ingested).toBe(2);
    expect(s.nearDuped).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('gracefully skips the gate (never blocks ingest) when render is best-effort and produces no perceptualHash', async () => {
    const llm = llmSeq(genJson(1), seoJson);
    const render = renderReturning(undefined); // render "succeeded" (preview keys) but no hash
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.nearDuped).toBe(0);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('drops a layout that near-duplicates an EXISTING DB hash on the very first target of the run', async () => {
    const llm = llmSeq(genJson(1), seoJson);
    const render = renderReturning(HASH_A);
    const ingest = vi.fn(async () => ({ deduped: false }));
    const nearDuplicateHashes = vi.fn(async () => [HASH_A]);
    const s = await runPipeline(baseDeps({ llm, render, ingest, nearDuplicateHashes }) as any);
    expect(nearDuplicateHashes).toHaveBeenCalledOnce();
    expect(s.ingested).toBe(0);
    expect(s.nearDuped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('does not poison the near-dupe pool when ingest throws for the first accepted layout (review fix)', async () => {
    // Target 1 renders successfully and clears the near-dupe gate, but its ingest
    // call throws. The message ('ingest boom') doesn't match any transient-infra
    // pattern in pipeline/errors.ts's classifier, so it's classified
    // permanent_infra/unknown (T2.2's safe default) and is NOT retried — which
    // matters here: a retry would re-call `ingest` for target 1 and consume the
    // mock's second canned response that this test reserves for target 2. Target
    // 2 then renders a near-identical hash. If the pool were populated BEFORE
    // ingest succeeds (the bug), target 2 would be wrongly dropped as a
    // near-dupe of a layout that was never actually accepted. It must be
    // ingested instead.
    const llm = llmSeq(genJson(1), seoJson, genJson(2), seoJson);
    const render = renderReturning(HASH_A); // identical hash for both targets
    const ingest = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('ingest boom');
      })
      .mockImplementationOnce(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ targets: [target, target2], llm, render, ingest }) as any);
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(s.errored).toBe(1); // target 1: ingest error (infra, unknown code, not retried)
    expect(s.nearDuped).toBe(0); // target 2 must NOT be wrongly near-dupe-dropped
    expect(s.ingested).toBe(1); // target 2: ingested normally
  });

  it('emits a near_duplicate RunEvent and tags llm_usage outcome=near_duplicate', async () => {
    const events: RunEvent[] = [];
    // T2.4: the 2nd (SEO) call must be floor-passing so this test's event
    // sequence isn't polluted by seo_floor_miss/seo_clamped noise unrelated
    // to what it's actually testing.
    const llm = llmWithUsageSeq([genJson(1), seoJson]);
    // Force a near-dupe against a pre-seeded DB pool so this single target drops.
    const render = renderReturning(HASH_A);
    const nearDuplicateHashes = vi.fn(async () => [HASH_A]);
    const deps = baseDeps({ llm, render, nearDuplicateHashes, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.nearDuped).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['generated', 'content_lint', 'near_duplicate', 'llm_usage']);
    const usageEvent = usageEventOf(events);
    expect(usageEvent.outcome).toBe('near_duplicate');
  });
});

// T4.1 review fix: no test previously exercised the RunEvent emission wiring
// itself (the eval harness's whole join to the pipeline depends on it). These
// assert the emitted event sequence AND that `llm_usage`'s `outcome` tag matches
// the target's real terminal fate, for the three canonical outcomes.
function llmWithUsage(response: string, usage = { costUsd: 0.01, inputTokens: 10, outputTokens: 5 }) {
  return { complete: vi.fn(async ({ onUsage }: { onUsage?: (u: typeof usage) => void }) => {
    onUsage?.(usage);
    return response;
  }) };
}

// T2.4: like `llmWithUsage`, but returns a DIFFERENT canned response per call
// (pinned to the last one once the list is exhausted) — needed wherever a test's
// SEO call must return a floor-passing response (see `seoJson`) even though its
// generate/repair call(s) return something else entirely.
function llmWithUsageSeq(responses: string[], usage = { costUsd: 0.01, inputTokens: 10, outputTokens: 5 }) {
  let i = 0;
  return { complete: vi.fn(async ({ onUsage }: { onUsage?: (u: typeof usage) => void }) => {
    onUsage?.(usage);
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return r;
  }) };
}

function usageEventOf(events: RunEvent[]) {
  const e = events.find((ev) => ev.type === 'llm_usage');
  if (!e || e.type !== 'llm_usage') throw new Error('no llm_usage event found');
  return e;
}

describe('runPipeline RunEvent emission', () => {
  it('ingested: emits generated → content_lint → ingested → llm_usage(outcome=ingested), usage summed across generate+seo calls', async () => {
    const events: RunEvent[] = [];
    // T2.4: floor-passing SEO response on the 2nd call — this test asserts the
    // exact event sequence, which would otherwise gain seo_floor_miss/seo_clamped.
    const llm = llmWithUsageSeq(['{"content":[]}', seoJson]);
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['generated', 'content_lint', 'ingested', 'llm_usage']);
    const usageEvent = usageEventOf(events);
    expect(usageEvent.outcome).toBe('ingested');
    // 2 llm.complete calls in the happy path (generate + seo) — usage accumulates across both.
    expect(usageEvent.usage).toEqual({ costUsd: 0.02, inputTokens: 20, outputTokens: 10 });
  });

  it('validation drop: emits generated → dropped(reason=validation) → llm_usage(outcome=dropped)', async () => {
    const events: RunEvent[] = [];
    const llm = llmWithUsage('{"content":[]}');
    const validate = vi.fn(async () => bad);
    // maxRepairs: 0 isolates the plain drop path from the separately-covered repair-loop behavior.
    const deps = baseDeps({ llm, validate, maxRepairs: 0, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.qualityDropped).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['generated', 'dropped', 'llm_usage']);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'validation' });
    const usageEvent = usageEventOf(events);
    expect(usageEvent.outcome).toBe('dropped');
    // only the generate call happens before the drop — no repair, no SEO call.
    expect(usageEvent.usage).toEqual({ costUsd: 0.01, inputTokens: 10, outputTokens: 5 });
  });

  it('dedupe skip: emits generated → content_lint → deduped → llm_usage(outcome=deduped), no SEO call counted', async () => {
    const events: RunEvent[] = [];
    const llm = llmWithUsage('{"content":[]}');
    const deps = baseDeps({ llm, isDuplicate: vi.fn(async () => true), onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.deduped).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['generated', 'content_lint', 'deduped', 'llm_usage']);
    const usageEvent = usageEventOf(events);
    expect(usageEvent.outcome).toBe('deduped');
    // dedupe check happens before generateSeo — only the generate call's usage counted.
    expect(usageEvent.usage).toEqual({ costUsd: 0.01, inputTokens: 10, outputTokens: 5 });
  });

  it('never fires llm_usage when the underlying llm client never reports usage (sawUsage stays false)', async () => {
    const events: RunEvent[] = [];
    const deps = baseDeps({ onEvent: (e: RunEvent) => events.push(e) }); // baseDeps' default llm never calls onUsage
    await runPipeline(deps as any);
    expect(events.some((e) => e.type === 'llm_usage')).toBe(false);
  });
});

// T1.3: closing the swallowed-render hole (pipeline/deps.ts's real renderer
// catches failures and returns `{ previewImageKeys: [] }`) — a renderer that IS
// wired but produced no real previews must be dropped, counted separately from
// `dropped`, and never ingested. Distinct from dry-run/unit-test semantics
// where `deps.render` is entirely absent (no renderer wired at all) — that must
// keep behaving exactly as before this task (placeholder previews from
// `upload()` sail straight through, matching `npm run pipeline -- <mode> --dry-run`).
describe('runPipeline render-miss gate (T1.3)', () => {
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }
  function genJsonWithContent(n = 1) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real, specific copy ${n}"} -->` });
  }

  it('drops when a wired renderer returns no real previews and does not ingest (renderFailed++)', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [] })); // renderer wired but produced nothing real
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.renderFailed).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('does NOT drop when no renderer is wired at all (dry-run/unit-test semantics preserved)', async () => {
    // baseDeps() supplies no `render` key at all — must behave exactly as before T1.3.
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ ingest }) as any);
    expect(s.renderFailed).toBe(0);
    expect(s.ingested).toBe(1);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('emits a render_failed RunEvent (not a generic dropped event) on a render-miss', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [] }));
    const deps = baseDeps({ llm, render, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    expect(events.some((e) => e.type === 'render_failed')).toBe(true);
    expect(events.some((e) => e.type === 'dropped')).toBe(false);
  });

  // Review fix (T1.3): a THROWING deps.render must take the exact same path as
  // a render that resolves with no previews — renderFailed++, no ingest — not
  // fall through to the generic top-level catch (which would tag it a plain
  // 'error' drop and never touch renderFailed at all). Also asserts the run
  // continues on to the next target rather than aborting the whole batch.
  it('a throwing deps.render counts as renderFailed (not a generic error drop) and the run continues to the next target', async () => {
    const target2 = { type: 'hero', niche: 'saas', style: 'bold' };
    const llm = llmSeq(genJsonWithContent(1), seoJson, genJsonWithContent(2), seoJson);
    const render = vi
      .fn()
      .mockRejectedValueOnce(new Error('render boom'))
      .mockResolvedValueOnce({ previewImageKeys: ['p'] });
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ targets: [target, target2], llm, render, ingest }) as any);
    expect(s.renderFailed).toBe(1);
    expect(s.qualityDropped).toBe(0); // must NOT land in the quality-drop counter
    expect(s.errored).toBe(0); // must NOT land in the generic infra-error counter either
    expect(s.ingested).toBe(1); // second target still generates → renders → ingests fine
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('emits render_failed (not a generic dropped event) when deps.render throws', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => {
      throw new Error('render boom');
    });
    const deps = baseDeps({ llm, render, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.renderFailed).toBe(1);
    expect(events.some((e) => e.type === 'render_failed')).toBe(true);
    expect(events.some((e) => e.type === 'dropped')).toBe(false);
  });

  // T2.1: a render can resolve WITHOUT throwing and WITHOUT real previews for
  // two different reasons — a confirmed-blank page (renderBlank) vs a generic
  // no-previews/infra miss (renderFailed) — and they must be counted/reported
  // distinctly, never conflated.
  it('a render stub resolving with outcome "blank" counts as renderBlank (not renderFailed) and does not ingest', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [], outcome: 'blank' as const }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.renderBlank).toBe(1);
    expect(s.renderFailed).toBe(0);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('emits a render_blank RunEvent (not render_failed or a generic dropped event) on a blank verdict', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [], outcome: 'blank' as const }));
    const deps = baseDeps({ llm, render, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.renderBlank).toBe(1);
    expect(events.some((e) => e.type === 'render_blank')).toBe(true);
    expect(events.some((e) => e.type === 'render_failed')).toBe(false);
    expect(events.some((e) => e.type === 'dropped')).toBe(false);
  });

  it('a render stub resolving with no outcome and empty previews still counts as renderFailed (legacy/back-compat behavior unchanged)', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [] })); // no outcome field at all
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.renderFailed).toBe(1);
    expect(s.renderBlank).toBe(0);
    expect(s.ingested).toBe(0);
  });

  it('a healthy render (outcome "ok" + previews) ingests normally and touches neither renderBlank nor renderFailed', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: ['p'], outcome: 'ok' as const }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.renderBlank).toBe(0);
    expect(s.renderFailed).toBe(0);
  });

  // T1.3 review Minor, closed by T2.1: render_failed must carry the thrown
  // error's message so the eval scoreboard/log isn't just "no real previews".
  it('a throwing deps.render carries the error message on the render_failed RunEvent detail field', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => {
      throw new Error('wp-cli exited 1');
    });
    const deps = baseDeps({ llm, render, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    const failed = events.find((e) => e.type === 'render_failed');
    expect(failed).toMatchObject({ detail: 'wp-cli exited 1' });
  });
});

// T1.3: after render (and after the T1.2 near-dupe gate — cheapest-first), score
// the real screenshots through the injected vision critic and drop anything
// below VISION_CRITIC_MIN_SCORE. Critic is optional/injected exactly like
// deps.render/deps.resolveImages — its absence must never change behavior.
describe('runPipeline vision critic gate (T1.3)', () => {
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }
  function genJsonWithContent(n = 1) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real, specific copy ${n}"} -->` });
  }
  function renderWithShots(paths: string[], perceptualHash = 'a'.repeat(64)) {
    return vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash, screenshotPaths: paths }));
  }

  it('drops a layout scoring below the default threshold (3) and never ingests it', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png', '/tmp/m.png']);
    const visionCritic = vi.fn(async () => ({ score: 2, issues: ['overlapping text'] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(visionCritic).toHaveBeenCalledWith(
      ['/tmp/d.png', '/tmp/m.png'],
      expect.objectContaining({ type: 'hero', niche: 'saas', style: 'minimal' }),
    );
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('ingests a layout scoring at/above the default threshold', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png', '/tmp/m.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(0);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it('respects a configurable threshold via deps.visionCriticMinScore', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 3, issues: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest, visionCriticMinScore: 4 }) as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
  });

  it('is skipped (no-op) when deps.visionCritic is absent, even with a wired renderer', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, ingest }) as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(0);
  });

  it('emits a vision_critic RunEvent for both pass and drop outcomes', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 2, issues: ['clipping'] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    const vc = events.find((e) => e.type === 'vision_critic');
    expect(vc).toMatchObject({ score: 2, issues: ['clipping'], passed: false });
  });

  // Review fix (T1.3): a below-threshold vision-critic drop previously only
  // emitted the `vision_critic` event — it never emitted a `dropped` event, so
  // the eval harness's dropReasonCounts under-totaled vs summary.qualityDropped
  // (the score-based drop was invisible in the drop-reason breakdown). Now it
  // must also emit `dropped` with a reason distinct from validation/content.
  it('also emits a dropped RunEvent with reason=vision_critic on a below-threshold drop', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 2, issues: ['clipping'] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.qualityDropped).toBe(1);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'vision_critic' });
  });

  it('never runs the critic on a render-miss (render-miss drop happens first, cheapest-first ordering)', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = vi.fn(async () => ({ previewImageKeys: [] }));
    const visionCritic = vi.fn(async () => ({ score: 5, issues: [] }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic }) as any);
    expect(visionCritic).not.toHaveBeenCalled();
    expect(s.renderFailed).toBe(1);
  });

  // Review fix (T1.3): a critic that THROWS (CLI failure, unparseable JSON) was
  // previously undocumented/untested — it fell to the generic top-level catch,
  // which happens to drop it (sensible: no unscored layout ships) but with no
  // distinct signal. Make the policy explicit and tested.
  it('drops the layout (does not ingest) when the vision critic itself throws', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => {
      throw new Error('claude CLI exited non-zero');
    });
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  // Review fix (T2.2): the vision critic is an LLM call. If a Phase B retry
  // (e.g. triggered by a transient ingest failure AFTER the critic already
  // scored this target) re-ran the whole Phase B body naively, it would
  // re-invoke the critic too — a second real LLM call for work already done.
  // The critic's score must be held/memoized across Phase B attempts.
  it('a Phase B retry after a successful vision-critic score does not re-invoke the critic (T2.2 review fix)', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [] }));
    const ingest = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ deduped: false });
    const sleep = vi.fn(async (_ms: number) => {});
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest, sleep }) as any);
    expect(s.ingested).toBe(1);
    expect(visionCritic).toHaveBeenCalledTimes(1); // NOT called again on the ingest retry
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('emits a dropped RunEvent with reason=vision_critic_error (not the generic error reason) when the critic throws', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => {
      throw new Error('claude CLI exited non-zero');
    });
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'vision_critic_error' });
    expect(events.some((e) => e.type === 'vision_critic')).toBe(false); // never scored — nothing to report
  });
});

// T5.1: the LLM copyScore rides the SAME folded critic call (pipeline/
// copy-critic.ts) — FLAG only, never a drop signal by itself.
describe('runPipeline copy critic (T5.1 — LLM copyScore, flag-only)', () => {
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }
  function genJsonWithContent(n = 1) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real, specific copy ${n}"} -->` });
  }
  function renderWithShots(paths: string[], perceptualHash = 'a'.repeat(64)) {
    return vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash, screenshotPaths: paths }));
  }

  it('flags a below-threshold copyScore but still ingests the layout (never drops for it alone)', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], copyScore: 1, copyIssues: ['generic tagline'] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const deps = baseDeps({ llm, render, visionCritic, ingest, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(0);
    expect(ingest).toHaveBeenCalledOnce();
    const cc = events.find((e) => e.type === 'copy_critic');
    expect(cc).toMatchObject({ copyScore: 1, copyIssues: ['generic tagline'], passed: false });
  });

  it('marks passed:true for a copyScore at/above the default threshold (3)', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], copyScore: 4, copyIssues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    const cc = events.find((e) => e.type === 'copy_critic');
    expect(cc).toMatchObject({ copyScore: 4, passed: true });
  });

  it('respects a configurable threshold via deps.copyCriticMinScore', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], copyScore: 3, copyIssues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, copyCriticMinScore: 4, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1); // still ingests — flag-only
    const cc = events.find((e) => e.type === 'copy_critic');
    expect(cc).toMatchObject({ copyScore: 3, passed: false });
  });

  it('does not emit copy_critic when the model omits copyScore (backward compatible)', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(events.some((e) => e.type === 'copy_critic')).toBe(false);
  });

  it('critic errors are unchanged: still drop with reason vision_critic_error, no copy_critic event', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => {
      throw new Error('claude CLI exited non-zero');
    });
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'vision_critic_error' });
    expect(events.some((e) => e.type === 'copy_critic')).toBe(false);
  });

  it('the critic call receives the extracted layout text as context.text', async () => {
    const llm = llmSeq(genJsonWithContent(7), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async (_paths: string[], _context: unknown) => ({ score: 4, issues: [] as string[] }));
    await runPipeline(baseDeps({ llm, render, visionCritic }) as any);
    const [, context] = visionCritic.mock.calls[0];
    expect((context as any).text).toContain('Ship faster with real, specific copy 7');
  });
});

// T5.2: image relevance rides the SAME folded critic call as copyScore
// (pipeline/vision-critic.ts) — FLAG only, per the controller resolution: a
// re-resolve loop would re-render and re-score (expensive), so a below-threshold
// imageRelevanceScore is logged + reported via a RunEvent but never drops the
// target on its own.
describe('runPipeline image relevance (T5.2 — LLM imageRelevanceScore, flag-only)', () => {
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }
  function genJsonWithContent(n = 1) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real, specific copy ${n}"} -->` });
  }
  function renderWithShots(paths: string[], perceptualHash = 'a'.repeat(64)) {
    return vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash, screenshotPaths: paths }));
  }

  it('flags a below-threshold imageRelevanceScore (off-topic hero image) but still ingests the layout', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({
      score: 4,
      issues: [],
      imageRelevanceScore: 1,
      imageIssues: ['hero photo shows a car, not a dental clinic'],
    }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const deps = baseDeps({ llm, render, visionCritic, ingest, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(0);
    expect(ingest).toHaveBeenCalledOnce();
    const ir = events.find((e) => e.type === 'image_relevance');
    expect(ir).toMatchObject({
      imageRelevanceScore: 1,
      imageIssues: ['hero photo shows a car, not a dental clinic'],
      passed: false,
    });
  });

  it('marks passed:true for an imageRelevanceScore at/above the default threshold (3)', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], imageRelevanceScore: 5, imageIssues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    const ir = events.find((e) => e.type === 'image_relevance');
    expect(ir).toMatchObject({ imageRelevanceScore: 5, passed: true });
  });

  it('respects a configurable threshold via deps.imageRelevanceMinScore', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], imageRelevanceScore: 3, imageIssues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, imageRelevanceMinScore: 4, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1); // still ingests — flag-only
    const ir = events.find((e) => e.type === 'image_relevance');
    expect(ir).toMatchObject({ imageRelevanceScore: 3, passed: false });
  });

  it('does not emit image_relevance when the model omits imageRelevanceScore (backward compatible)', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(events.some((e) => e.type === 'image_relevance')).toBe(false);
  });

  it('critic errors are unchanged: still drop with reason vision_critic_error, no image_relevance event', async () => {
    const events: RunEvent[] = [];
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => {
      throw new Error('claude CLI exited non-zero');
    });
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'vision_critic_error' });
    expect(events.some((e) => e.type === 'image_relevance')).toBe(false);
  });

  it('a Phase B retry after a successful score does not re-emit image_relevance a second time', async () => {
    const llm = llmSeq(genJsonWithContent(), seoJson);
    const render = renderWithShots(['/tmp/d.png']);
    const visionCritic = vi.fn(async () => ({ score: 4, issues: [], imageRelevanceScore: 2, imageIssues: ['off-topic'] }));
    const events: RunEvent[] = [];
    const ingest = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ deduped: false });
    const sleep = vi.fn(async (_ms: number) => {});
    const deps = baseDeps({ llm, render, visionCritic, ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(visionCritic).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === 'image_relevance')).toHaveLength(1);
  });
});

// T5.2: placeholder-miss rate metric. content-lint.ts's PLACEHOLDER_IMAGE code
// is deliberately excluded from the drop-worthy set (the Pexels swap is
// best-effort infra, not a copy-quality failure) — a layout carrying a
// surviving placeholder-image URL still ships, but must be visible in the eval
// scoreboard as a Pexels-miss signal (a RunEvent alongside the existing warn log).
describe('runPipeline placeholder-image miss (T5.2)', () => {
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }

  it('emits a placeholder_image_miss RunEvent when a PLACEHOLDER_IMAGE lint violation survives repair, and still ingests', async () => {
    const withPlaceholderImage = JSON.stringify({
      post_title: 'T',
      post_content: '<!-- wp:divi/image {"src":"https://placehold.co/800x600"} -->',
    });
    const llm = llmSeq(withPlaceholderImage, seoJson);
    const events: RunEvent[] = [];
    const ingest = vi.fn(async () => ({ deduped: false }));
    const deps = baseDeps({ llm, ingest, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(0);
    const miss = events.find((e) => e.type === 'placeholder_image_miss');
    expect(miss).toBeDefined();
    expect(miss).toMatchObject({ target });
  });

  it('does not emit placeholder_image_miss for a clean layout with no image-host violations', async () => {
    const clean = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/text {"content":"Ship faster with real copy"} -->' });
    const llm = llmSeq(clean, seoJson);
    const events: RunEvent[] = [];
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(events.some((e) => e.type === 'placeholder_image_miss')).toBe(false);
  });
});

// T5.1: deterministic cross-layout boilerplate detection — a DROP, distinct from
// (and independent of) the LLM copyScore flag above. No LLM call is involved:
// this is a Phase A gate (pipeline/copy-critic.ts's `isCopyBoilerplate`), so it
// never even reaches upload/render/vision-critic for the dropped target.
describe('runPipeline copy-boilerplate gate (T5.1, deterministic)', () => {
  const targetA = { type: 'hero', niche: 'saas', style: 'minimal' };
  const targetB = { type: 'hero', niche: 'saas', style: 'bold' };
  const BOILERPLATE = 'We deliver quality solutions to help your business grow and succeed in a competitive market today';

  function genWithText(n: number, text: string) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"${text}"} -->` });
  }
  function llmSeq(...responses: string[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return { complete: fn };
  }

  it('ingests the first occurrence, then drops a near-identical second layout as copy_boilerplate — cheaply, before upload/render', async () => {
    const llm = llmSeq(genWithText(1, BOILERPLATE), seoJson, genWithText(2, BOILERPLATE));
    const upload = vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['p'] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const events: RunEvent[] = [];
    const s = await runPipeline(baseDeps({
      targets: [targetA, targetB],
      llm, upload, ingest,
      onEvent: (e: RunEvent) => events.push(e),
    }) as any);
    expect(s.ingested).toBe(1);
    expect(s.qualityDropped).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1); // second target never reaches Phase B at all
    const dropped = events.find((e) => e.type === 'dropped' && (e as any).reason === 'copy_boilerplate');
    expect(dropped).toBeTruthy();
  });

  it('does not drop two independently-written, distinct layouts', async () => {
    const llm = llmSeq(
      genWithText(1, 'Same-day emergency plumbing for Austin homeowners licensed and insured'),
      seoJson,
      genWithText(2, 'Boutique bridal photography across the Hill Country booking weekends now'),
      seoJson,
    );
    const s = await runPipeline(baseDeps({ targets: [targetA, targetB], llm }) as any);
    expect(s.ingested).toBe(2);
    expect(s.qualityDropped).toBe(0);
  });

  it('does not apply the boilerplate gate to a theme run (growDedupePools: false — sibling pages share brand copy on purpose)', async () => {
    // Simulates the theme wrapper's ctx (createRunContext with growDedupePools:
    // false) by driving processItem directly through two items with identical text.
    const { createRunContext, processItem } = await import('@/pipeline/run');
    const llm = llmSeq(genWithText(1, BOILERPLATE), seoJson, genWithText(2, BOILERPLATE), seoJson);
    const deps = baseDeps({ llm }) as any;
    const ctx = await createRunContext(deps, { growDedupePools: false });
    const r1 = await processItem({ target: targetA }, ctx);
    const r2 = await processItem({ target: targetB }, ctx);
    expect(r1.outcome).toBe('ingested');
    expect(r2.outcome).toBe('ingested'); // NOT dropped — theme pages skip this gate
  });

  // Review fix (T5.1 review, Important): the boilerplate gate must run AFTER the
  // pre-existing content-hash dedupe check, not before it. A same-run
  // byte-identical duplicate is the SAME layout being re-submitted, not a
  // distinct layout that happens to reuse boilerplate wording — it must be
  // classified `deduped` (T1.x's existing semantics), never `copy_boilerplate`.
  // Before the fix, the boilerplate gate ran first in Phase A and claimed this
  // case as a quality drop, so `deduped` never incremented and `ingest` was
  // never even attempted for a target real dedupe should have short-circuited
  // identically to the pre-T5.1 "skips a duplicate" test above.
  it('classifies a same-run byte-identical duplicate as deduped, not copy_boilerplate (gate ordering)', async () => {
    function genFixed(text: string) {
      // Deliberately IDENTICAL post_title/post_content both times — byte-for-byte
      // the same JSON, so `contentHash` is identical and the dedupe check (which
      // runs after Phase A's mobile-stack normalization) recognizes it as a repeat
      // of the layout the previous target in THIS run already had ingested.
      return JSON.stringify({ post_title: 'Fixed Title', post_content: `<!-- wp:divi/text {"content":"${text}"} -->` });
    }
    const llm = llmSeq(genFixed(BOILERPLATE), seoJson, genFixed(BOILERPLATE));
    const seenHashes = new Set<string>();
    const isDuplicate = vi.fn(async (hash: string) => {
      if (seenHashes.has(hash)) return true;
      seenHashes.add(hash);
      return false;
    });
    const ingest = vi.fn(async () => ({ deduped: false }));
    const events: RunEvent[] = [];
    const s = await runPipeline(baseDeps({
      targets: [targetA, targetB],
      llm, isDuplicate, ingest,
      onEvent: (e: RunEvent) => events.push(e),
    }) as any);
    expect(s.ingested).toBe(1);
    expect(s.deduped).toBe(1);
    expect(s.qualityDropped).toBe(0); // must NOT be classified as copy_boilerplate
    expect(ingest).toHaveBeenCalledOnce();
    const dropped = events.find((e) => e.type === 'dropped' && (e as any).reason === 'copy_boilerplate');
    expect(dropped).toBeUndefined();
    expect(events.some((e) => e.type === 'deduped')).toBe(true);
  });

  // Review fix (T5.1 review, Minor): mirrors the near-dupe-pool poisoning
  // regression test above (`does not poison the near-dupe pool when ingest
  // throws...`) for the new `copyTextPool`. A layout must only join the
  // boilerplate-comparison pool once it has ACTUALLY been ingested —
  // `applyPhaseBOutcome`'s `copyTextPool.push` only runs on the `'ingested'`
  // branch, which is only reached after `withRetry` resolves successfully, so a
  // throwing ingest for target 1 must never let target 1's text poison the pool
  // against target 2.
  it('does not poison the copy-text pool when ingest throws for the first accepted layout (review fix)', async () => {
    const llm = llmSeq(genWithText(1, BOILERPLATE), seoJson, genWithText(2, BOILERPLATE), seoJson);
    const ingest = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('ingest boom');
      })
      .mockImplementationOnce(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ targets: [targetA, targetB], llm, ingest }) as any);
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(s.errored).toBe(1); // target 1: ingest error (infra, unknown code, not retried)
    expect(s.qualityDropped).toBe(0); // target 2 must NOT be wrongly copy_boilerplate-dropped
    expect(s.ingested).toBe(1); // target 2: ingested normally
  });
});

// T2.2: classify errors caught by the per-target catch into transient_infra
// (retried with bounded exponential backoff) vs permanent_infra (usage-limit,
// budget, auth, or an unrecognized error — never retried). Quality gates
// (validation/content/vision-critic/near-dupe/render-miss) never throw, so
// they're covered by the existing describe blocks above, unaffected by any of
// this — see the "does NOT touch qualityDropped" assertions below.
describe('runPipeline error classification + retry with backoff (T2.2)', () => {
  it('retries a transient failure (e.g. ECONNRESET) at the per-target level, using the injected sleep, then succeeds', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    const ingest = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNRESET'))
      .mockResolvedValueOnce({ deduped: false });
    const deps = baseDeps({ ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(s.errored).toBe(0);
    expect(s.qualityDropped).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(2); // 1 failed attempt + 1 successful retry
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250); // default base delay, attempt 1
    const retryEvents = events.filter((e) => e.type === 'retry');
    expect(retryEvents).toEqual([{ type: 'retry', target, attempt: 1, code: 'network', detail: 'connect ECONNRESET' }]);
    expect(events.some((e) => e.type === 'errored')).toBe(false);
  });

  // Review fix (T2.2): the original implementation wrapped the ENTIRE
  // per-target body (Phase A generation + Phase B infra) in `withRetry`, so a
  // transient Phase B failure (e.g. ingest) re-ran Phase A from scratch too —
  // double-charging LLM calls already completed (constraint #7 violation).
  // The brief never sanctioned this (a prior report claimed otherwise; that
  // claim was wrong and has been corrected). Now Phase A (generate/compose,
  // validate+repair, content-lint, dedupe-hash, SEO) runs ONCE per target and
  // is NOT wrapped in the retry boundary; only Phase B (upload/render/near-dup/
  // vision-critic/ingest) is retried, reusing Phase A's output.
  it('a Phase B retry (e.g. a transient ingest failure) does NOT re-generate — Phase A runs exactly once, llm.complete count unchanged by the retry', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    // T2.4: 2nd (SEO) call must be floor-passing, or the new quality-floor
    // retry would add a 3rd llm.complete call this test explicitly rules out.
    const llm = llmWithUsageSeq([
      '{"post_title":"T","post_content":"<!-- wp:divi/text {\\"content\\":\\"Ship faster with real copy\\"} -->"}',
      seoJson,
    ]);
    const ingest = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ deduped: false });
    const deps = baseDeps({ llm, ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(s.generated).toBe(1); // Phase A (generation) ran exactly ONCE, not re-run by the Phase B retry
    // Only 2 llm.complete calls total for this target (generate + seo) — the
    // ingest-triggered retry must not add any more (no re-generation, no re-SEO).
    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect(ingest).toHaveBeenCalledTimes(2);
    const usageEvent = usageEventOf(events);
    // usage is the true total spend for this target — still just the ONE
    // generate + ONE seo call's worth (0.01 x 2), since Phase A never re-ran.
    expect(usageEvent.usage.costUsd).toBeCloseTo(0.02, 5);
  });

  // Review fix (T2.2): post-ingest bookkeeping (nearDupPool push, summary.ingested++,
  // log, the 'ingested' onEvent) previously ran INSIDE the retry boundary, so a
  // throwing event consumer AFTER a successful ingest retried the whole target
  // and called ingest a second time (reviewer's probe: ingest called 2x,
  // summary.ingested=2). It must now be impossible: bookkeeping happens once,
  // strictly after Phase B's retry loop has resolved.
  it('a transient throw AFTER a successful ingest (e.g. a throwing onEvent consumer) does not re-ingest and does not double-count', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    let sawIngestedEvent = false;
    const onEvent = (e: RunEvent) => {
      if (e.type === 'ingested') {
        sawIngestedEvent = true;
        throw new Error('boom from a misbehaving event consumer');
      }
    };
    const deps = baseDeps({ ingest, onEvent });
    const s = await runPipeline(deps as any);
    expect(sawIngestedEvent).toBe(true);
    expect(ingest).toHaveBeenCalledTimes(1); // must NOT be called again
    expect(s.ingested).toBe(1); // must NOT be double-counted
    expect(s.errored).toBe(0);
  });

  it('never retries a permanent_infra failure (e.g. an auth error) — fails on the first attempt and counts as errored, not qualityDropped', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    const ingest = vi.fn(async () => {
      throw new Error('401 unauthorized: invalid api key');
    });
    const deps = baseDeps({ ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(s.qualityDropped).toBe(0);
    expect(s.ingested).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(1); // no retry at all
    expect(sleep).not.toHaveBeenCalled();
    const errored = events.find((e) => e.type === 'errored');
    expect(errored).toMatchObject({ class: 'permanent_infra', code: 'auth', attempts: 1 });
    expect(events.some((e) => e.type === 'dropped')).toBe(false);
  });

  it('an unrecognized error is also never retried (safe default) and counts as errored', async () => {
    const ingest = vi.fn(async () => {
      throw new Error('something bizarre happened');
    });
    const sleep = vi.fn(async (_ms: number) => {});
    const s = await runPipeline(baseDeps({ ingest, sleep }) as any);
    expect(s.errored).toBe(1);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('a transient failure that never recovers exhausts its bounded retry budget (default 2) and counts as errored', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    const ingest = vi.fn(async () => {
      throw new Error('ETIMEDOUT');
    });
    const deps = baseDeps({ ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(ingest).toHaveBeenCalledTimes(3); // 1 initial + 2 retries, then give up
    expect(sleep).toHaveBeenCalledTimes(2);
    // exponential backoff: 250ms, then 500ms
    expect(sleep.mock.calls[0][0]).toBe(250);
    expect(sleep.mock.calls[1][0]).toBe(500);
    const errored = events.find((e) => e.type === 'errored');
    expect(errored).toMatchObject({ class: 'transient_infra', code: 'network', attempts: 3 });
  });

  it('respects a configurable maxRetries/retryBaseDelayMs on RunDeps', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const ingest = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const deps = baseDeps({ ingest, sleep, maxRetries: 1, retryBaseDelayMs: 10 });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(ingest).toHaveBeenCalledTimes(2); // 1 initial + only 1 retry allowed
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  // Acceptance criterion: "a validator/lint failure counts as qualityDropped" —
  // already covered by the un-renamed tests above (validation drop, content
  // drop); this asserts the same for the render-miss/vision-critic gates too,
  // confirming NONE of the T2.2 retry/error machinery is reachable from a
  // quality gate (they `return`, never `throw`).
  it('quality gates never retry and never touch errored (validate/content/render-miss/vision-critic all still counted correctly)', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const s = await runPipeline(baseDeps({ validate: vi.fn(async () => bad), sleep }) as any);
    expect(s.qualityDropped).toBe(1);
    expect(s.errored).toBe(0);
    expect(sleep).not.toHaveBeenCalled(); // never even considered for retry
  });

  it('a usage-limit error from generation is never retried and ABORTS the rest of the run (subsequent targets are never attempted)', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    const target2 = { type: 'hero', niche: 'saas', style: 'bold' };
    const llm = { complete: vi.fn(async () => 'You have hit your limit for this session, please try again later') };
    const ingest = vi.fn(async () => ({ deduped: false }));
    const deps = baseDeps({ targets: [target, target2], llm, ingest, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(s.generated).toBe(0); // generateLayout throws before summary.generated++
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled(); // non-retryable, no backoff
    // Only ONE llm.complete call total — target 2 was never even started because
    // the run aborted after target 1's usage-limit error.
    expect(llm.complete).toHaveBeenCalledTimes(1);
    const errored = events.find((e) => e.type === 'errored');
    expect(errored).toMatchObject({ class: 'permanent_infra', code: 'usage_limit', attempts: 1 });
  });

  // Minor (T2.2 review): an invalid API key can't recover mid-run either — every
  // remaining target would fail identically. Extend the abort behavior (until
  // now usage_limit-only) to the 'auth' code too.
  it('an auth error also ABORTS the rest of the run (an invalid API key cannot recover mid-run)', async () => {
    const events: RunEvent[] = [];
    const target2 = { type: 'hero', niche: 'saas', style: 'bold' };
    const ingest = vi.fn(async () => {
      throw new Error('401 unauthorized: invalid api key');
    });
    const deps = baseDeps({ targets: [target, target2], ingest, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(ingest).toHaveBeenCalledTimes(1); // target 2 never attempted
    const errored = events.find((e) => e.type === 'errored');
    expect(errored).toMatchObject({ class: 'permanent_infra', code: 'auth' });
  });
});

// Followups #3: `renderMemo.screenshotPaths` are LOCAL file paths the vision
// critic's `claude` CLI call can Read; `previewImageKeys` are Vercel Blob
// storage keys it can't open. A renderer that succeeds (real previews) but
// never populates `screenshotPaths` (e.g. a caller that doesn't wire the T2.1
// render-outcome contract) used to fall back to handing the critic the blob
// keys instead — this policy removes that fallback and drops the target
// instead (consistent with the "no unscored layout ships" policy already
// applied to a throwing/unparseable critic call).
describe('runPipeline vision critic — missing local screenshot paths guard (followups #3)', () => {
  const genSection = (n = 1) => JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real, specific copy ${n}"} -->` });

  it('drops (does not ingest) and never invokes the critic when render succeeded but screenshotPaths is empty', async () => {
    const llm = { complete: vi.fn().mockResolvedValueOnce(genSection()).mockResolvedValueOnce(seoJson) };
    // Succeeds (real previewImageKeys + perceptualHash) but no screenshotPaths at all.
    const render = vi.fn(async () => ({ previewImageKeys: ['blob-key-desktop'], perceptualHash: 'b'.repeat(64) }));
    const visionCritic = vi.fn(async () => ({ score: 5, issues: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(visionCritic).not.toHaveBeenCalled();
    expect(s.qualityDropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('emits a dropped RunEvent with reason=vision_critic_error (distinct from a generic error) when screenshotPaths is missing', async () => {
    const events: RunEvent[] = [];
    const llm = { complete: vi.fn().mockResolvedValueOnce(genSection()).mockResolvedValueOnce(seoJson) };
    const render = vi.fn(async () => ({ previewImageKeys: ['blob-key-desktop'], perceptualHash: 'b'.repeat(64) }));
    const visionCritic = vi.fn(async () => ({ score: 5, issues: [] }));
    const deps = baseDeps({ llm, render, visionCritic, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    const dropped = events.find((e) => e.type === 'dropped');
    expect(dropped).toMatchObject({ reason: 'vision_critic_error' });
    expect(events.some((e) => e.type === 'vision_critic')).toBe(false); // never scored
  });

  it('an explicit empty screenshotPaths array is treated the same as an absent one', async () => {
    const llm = { complete: vi.fn().mockResolvedValueOnce(genSection()).mockResolvedValueOnce(seoJson) };
    const render = vi.fn(async () => ({ previewImageKeys: ['blob-key-desktop'], perceptualHash: 'b'.repeat(64), screenshotPaths: [] }));
    const visionCritic = vi.fn(async () => ({ score: 5, issues: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(visionCritic).not.toHaveBeenCalled();
    expect(s.qualityDropped).toBe(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('still runs the critic normally when screenshotPaths IS populated (no regression)', async () => {
    const llm = { complete: vi.fn().mockResolvedValueOnce(genSection()).mockResolvedValueOnce(seoJson) };
    const render = vi.fn(async () => ({ previewImageKeys: ['blob-key-desktop'], perceptualHash: 'b'.repeat(64), screenshotPaths: ['/tmp/d.png'] }));
    const visionCritic = vi.fn(async () => ({ score: 5, issues: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ llm, render, visionCritic, ingest }) as any);
    expect(visionCritic).toHaveBeenCalledWith(['/tmp/d.png'], expect.anything());
    expect(s.ingested).toBe(1);
    expect(ingest).toHaveBeenCalledOnce();
  });
});

// Followups #4: T2.2's ledger flagged the Phase A (generation/validation,
// pre-render) transient-infra path as untested — Phase A deliberately runs
// EXACTLY ONCE per target (never wrapped in withRetry; see the module doc
// above runPhaseA in run.ts) so as not to double-charge LLM calls already
// completed if a LATER (Phase B) call fails. This proves that invariant holds
// even for a transient-classified error thrown mid-generation: no retry, one
// llm.complete call, counted as errored (not qualityDropped), with an errored
// RunEvent tagged transient_infra.
describe('runPipeline Phase A transient-infra failure is never retried (followups #4)', () => {
  it('an ECONNRESET thrown from llm.complete during generation errors once, with no retry', async () => {
    const events: RunEvent[] = [];
    const sleep = vi.fn(async (_ms: number) => {});
    const llm = { complete: vi.fn(async () => { throw new Error('connect ECONNRESET'); }) };
    const deps = baseDeps({ llm, sleep, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.errored).toBe(1);
    expect(s.qualityDropped).toBe(0);
    expect(s.ingested).toBe(0);
    expect(llm.complete).toHaveBeenCalledTimes(1); // Phase A is never retried, even for transient_infra
    expect(sleep).not.toHaveBeenCalled();
    const errored = events.find((e) => e.type === 'errored');
    expect(errored).toMatchObject({ class: 'transient_infra', code: 'network', attempts: 1 });
  });
});

// T2.4: SEO quality floor + clamp visibility, wired end-to-end through
// runPipeline's Phase A (pipeline/seo.ts owns the retry/clamp logic itself;
// this only proves run.ts turns its result into the right RunEvents and never
// drops the target for either signal).
describe('runPipeline SEO quality floor + clamp visibility (T2.4)', () => {
  const thinSeo = JSON.stringify({
    title: 'T',
    metaDescription: 'short',
    keywords: ['x'],
    axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] },
  });

  it('emits seo_floor_miss (and still ingests) when metaDescription/keywords stay thin after the retry', async () => {
    const events: RunEvent[] = [];
    // generate, then SEO call #1 and its retry both return thin metadata.
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('{"content":[]}')
      .mockResolvedValueOnce(thinSeo)
      .mockResolvedValueOnce(thinSeo) };
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1); // NOT a drop gate
    expect(llm.complete).toHaveBeenCalledTimes(3); // generate + seo + one seo retry
    const floorMiss = events.find((e) => e.type === 'seo_floor_miss');
    expect(floorMiss).toMatchObject({ metaDescriptionLength: 5, keywordCount: 1 });
  });

  it('does not emit seo_floor_miss once the retry produces floor-passing metadata', async () => {
    const events: RunEvent[] = [];
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('{"content":[]}')
      .mockResolvedValueOnce(thinSeo)
      .mockResolvedValueOnce(seoJson) };
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1);
    expect(events.some((e) => e.type === 'seo_floor_miss')).toBe(false);
  });

  it('emits one seo_clamped event per off-enum axis/color value, and still ingests', async () => {
    const events: RunEvent[] = [];
    const clampedSeo = JSON.stringify({
      title: 'T',
      metaDescription: 'A clean, conversion-focused section built for real marketing teams shipping fast.',
      keywords: ['hero', 'saas', 'minimal'],
      axes: { type: 'bogus-type', niche: 'saas', style: 'minimal', colors: ['blue', 'not-a-real-color'] },
    });
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('{"content":[]}')
      .mockResolvedValueOnce(clampedSeo) };
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    const s = await runPipeline(deps as any);
    expect(s.ingested).toBe(1); // clamps are a QA signal, never a drop gate
    const clamps = events.filter((e) => e.type === 'seo_clamped');
    expect(clamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ axis: 'type', proposed: 'bogus-type', clamped: 'hero' }),
        expect.objectContaining({ axis: 'colors', proposed: ['blue', 'not-a-real-color'], clamped: ['blue'] }),
      ]),
    );
  });

  it('emits no seo_clamped events when every axis value is already valid', async () => {
    const events: RunEvent[] = [];
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('{"content":[]}')
      .mockResolvedValueOnce(seoJson) };
    const deps = baseDeps({ llm, onEvent: (e: RunEvent) => events.push(e) });
    await runPipeline(deps as any);
    expect(events.some((e) => e.type === 'seo_clamped')).toBe(false);
  });
});
