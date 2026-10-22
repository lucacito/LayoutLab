import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ now: 0, registrations: [] as { keys: string[]; revalidate: number }[] }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[], options: { revalidate: number }) => {
    state.registrations.push({ keys, revalidate: options.revalidate });
    const entries = new Map<string, { value: unknown; expires: number }>();
    return async (...args: unknown[]) => {
      const key = JSON.stringify(args);
      const entry = entries.get(key);
      if (entry && entry.expires > state.now) return entry.value;
      const value = JSON.parse(JSON.stringify(await fn(...args)));
      entries.set(key, { value, expires: state.now + options.revalidate });
      return value;
    };
  },
}));

import { cachePublicRead } from '@/lib/catalog/cache-public-read';

describe('public catalog cache', () => {
  beforeEach(() => { state.now = 0; state.registrations.length = 0; });

  it('reuses reads across requests, separates arguments, and refreshes after five minutes', async () => {
    const read = vi.fn(async (slug: string) => ({ slug }));
    const cached = cachePublicRead('test-layout', read);
    await cached('hero');
    await cached('hero');
    expect(read).toHaveBeenCalledTimes(1);
    await cached('footer');
    expect(read).toHaveBeenCalledTimes(2);
    state.now = 301;
    await cached('hero');
    expect(read).toHaveBeenCalledTimes(3);
    expect(state.registrations).toEqual([{ keys: ['public-catalog-v1', 'test-layout'], revalidate: 300 }]);
  });

  it('preserves database Dates, nulls, and ISO strings through JSON cache storage', async () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const cached = cachePublicRead('dates', async () => [{ createdAt: date, publishedAt: null, title: date.toISOString() }]);
    await cached();
    const [row] = await cached();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.createdAt.toISOString()).toBe(date.toISOString());
    expect(row.publishedAt).toBeNull();
    expect(row.title).toBe(date.toISOString());
  });

  it('does not retain failed database reads', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(42);
    const cached = cachePublicRead('retry', read);
    await expect(cached()).rejects.toThrow('offline');
    await expect(cached()).resolves.toBe(42);
  });
});

// Guard the boundary: caching display data must not silently cache entitlement
// checks or the raw functions shared with checkout/download/admin handlers.
describe('public cache wiring', () => {
  it('routes taxonomy and sitemap reads through the public cache only', async () => {
    const { readFileSync } = await import('node:fs');
    const taxonomy = readFileSync('lib/seo/taxonomy-page.tsx', 'utf8');
    const sitemap = readFileSync('app/sitemap.ts', 'utf8');
    expect(taxonomy).toContain("from '@/lib/catalog/public-queries'");
    expect(taxonomy).toContain("from '@/lib/seo/public-taxonomy'");
    expect(sitemap).toContain("from '@/lib/catalog/public-queries'");
    expect(readFileSync('lib/catalog/queries.ts', 'utf8')).not.toContain('cachePublicRead');
    expect(readFileSync('lib/seo/taxonomy.ts', 'utf8')).not.toContain('cachePublicRead');
  });
});
