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
const seoJson = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'd', keywords: [], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });

function renderReturning(perceptualHash: string | undefined) {
  return vi.fn(async () => ({ previewImageKeys: ['p'], perceptualHash }));
}

describe('runPipeline', () => {
  it('happy path: generate → validate → upload → ingest, summary counts 1 ingested', async () => {
    const deps = baseDeps();
    const s = await runPipeline(deps as any);
    expect(s).toMatchObject({ generated: 1, dropped: 0, deduped: 0, ingested: 1 });
    expect(deps.ingest).toHaveBeenCalledOnce();
  });

  it('repairs once when first validation fails then passes', async () => {
    const validate = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(ok);
    const llm = { complete: vi.fn(async () => '{"content":[]}') };
    const s = await runPipeline(baseDeps({ validate, llm }) as any);
    expect(s.repaired).toBe(1);
    expect(s.ingested).toBe(1);
    expect(llm.complete).toHaveBeenCalledTimes(3); // generate + repair + seo
  });

  it('drops a layout that never validates and never ingests it', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ validate: vi.fn(async () => bad), ingest }) as any);
    expect(s.dropped).toBe(1);
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
    const seo = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'd', keywords: [], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });
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
    expect(s.dropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('content gate: does NOT drop clean copy that only has an unresolved placeholder image (best-effort)', async () => {
    const clean = JSON.stringify({ post_title: 'T', post_content: '<!-- wp:divi/image {"src":"https://loremflickr.com/800/600/saas"} -->Real specific headline here' });
    const seo = JSON.stringify({ title: 'T', slug: 's', metaDescription: 'd', keywords: [], axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: [] } });
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
      return JSON.stringify({ title: 'T', slug: 's', metaDescription: 'd', keywords: [], axes: { type: 'full_landing', niche: 'coaching', style: 'elegant', colors: [] } });
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
  function genJson(n: number) {
    return JSON.stringify({ post_title: `T${n}`, post_content: `<!-- wp:divi/text {"content":"Ship faster with real copy number ${n}"} -->` });
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

  it('emits a near_duplicate RunEvent and tags llm_usage outcome=near_duplicate', async () => {
    const events: RunEvent[] = [];
    const llm = llmWithUsage(genJson(1));
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

function usageEventOf(events: RunEvent[]) {
  const e = events.find((ev) => ev.type === 'llm_usage');
  if (!e || e.type !== 'llm_usage') throw new Error('no llm_usage event found');
  return e;
}

describe('runPipeline RunEvent emission', () => {
  it('ingested: emits generated → content_lint → ingested → llm_usage(outcome=ingested), usage summed across generate+seo calls', async () => {
    const events: RunEvent[] = [];
    const llm = llmWithUsage('{"content":[]}');
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
    expect(s.dropped).toBe(1);
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
