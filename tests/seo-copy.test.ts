import { describe, it, expect, vi } from 'vitest';
import { generateTaxonomyCopy } from '@/pipeline/seo-copy';

const BODY = 'Long-form landing body copy. '.repeat(30);
const VALID = JSON.stringify({ intro: 'AI intro', body: BODY, metaTitle: 'AI title', metaDescription: 'AI desc' });

function deps(over: Partial<any> = {}) {
  return {
    llm: { complete: vi.fn(async () => VALID) },
    getCopy: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    log: () => {},
    ...over,
  };
}

describe('generateTaxonomyCopy', () => {
  it('skips values that already have stored copy', async () => {
    const d = deps({ getCopy: vi.fn(async () => ({ intro: 'x', body: 'existing body', metaTitle: 'x', metaDescription: 'x' })) });
    const r = await generateTaxonomyCopy(d);
    expect(d.llm.complete).not.toHaveBeenCalled();
    expect(d.upsert).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThan(0);
    expect(r.generated).toBe(0);
  });

  it('generates + upserts valid copy for every missing value', async () => {
    const d = deps();
    const r = await generateTaxonomyCopy(d);
    expect(d.upsert).toHaveBeenCalled();
    expect(r.generated).toBeGreaterThan(0);
    expect(r.failed).toBe(0);
    // upsert receives the parsed AI copy
    const firstCall = d.upsert.mock.calls[0] as unknown[];
    expect(firstCall[2]).toEqual({ intro: 'AI intro', body: BODY.trim(), metaTitle: 'AI title', metaDescription: 'AI desc' });
  });

  it('REgenerates rows that have intro copy but no body yet (backfill path)', async () => {
    const d = deps({ getCopy: vi.fn(async () => ({ intro: 'x', body: null, metaTitle: 'x', metaDescription: 'x' })) });
    const r = await generateTaxonomyCopy(d);
    expect(d.llm.complete).toHaveBeenCalled();
    expect(r.generated).toBeGreaterThan(0);
    expect(r.skipped).toBe(0);
  });

  it('continues (does not throw) when one value returns unparseable output', async () => {
    let n = 0;
    const d = deps({ llm: { complete: vi.fn(async () => (n++ === 0 ? 'not json' : VALID)) } });
    const r = await generateTaxonomyCopy(d);
    expect(r.failed).toBe(1);
    expect(r.generated).toBeGreaterThan(0); // the rest still succeed
  });
});
