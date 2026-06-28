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
});
