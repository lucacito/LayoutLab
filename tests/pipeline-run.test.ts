// tests/pipeline-run.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '@/pipeline/run';

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
