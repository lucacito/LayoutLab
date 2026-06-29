import { describe, it, expect, vi } from 'vitest';
import { resolveImages, resolveLayoutImages, type ImageSearcher } from '@/pipeline/images';

function searcher(map: Record<string, string[]>): ImageSearcher {
  return { search: vi.fn(async (q: string) => map[q] ?? []) };
}

describe('resolveImages', () => {
  it('replaces loremflickr placeholders with real photo URLs by keyword', async () => {
    const content = '<img src="https://loremflickr.com/1200/800/restaurant,food" />';
    const out = await resolveImages(content, searcher({ 'restaurant food': ['https://pexels/A.jpg'] }));
    expect(out).toBe('<img src="https://pexels/A.jpg" />');
  });

  it('cycles within the pool so repeated keywords vary', async () => {
    const content = 'a https://loremflickr.com/400/400/team b https://loremflickr.com/400/400/team';
    const out = await resolveImages(content, searcher({ team: ['https://p/1.jpg', 'https://p/2.jpg'] }));
    expect(out).toBe('a https://p/1.jpg b https://p/2.jpg');
  });

  it('falls back to the placeholder when the search returns nothing', async () => {
    const content = 'x https://loremflickr.com/800/600/obscure y';
    const out = await resolveImages(content, searcher({}));
    expect(out).toBe(content);
  });

  it('leaves content without placeholders unchanged', async () => {
    const content = '<img src="https://i.pravatar.cc/120?u=1" />';
    const s = searcher({});
    expect(await resolveImages(content, s)).toBe(content);
    expect(s.search).not.toHaveBeenCalled();
  });
});

describe('resolveLayoutImages', () => {
  it('resolves images inside the post_content of a layout JSON', async () => {
    const json = JSON.stringify({ post_title: 'Hero', post_content: 'pic https://loremflickr.com/1600/900/saas,office' });
    const out = JSON.parse(await resolveLayoutImages(json, searcher({ 'saas office': ['https://p/x.jpg'] })));
    expect(out.post_content).toBe('pic https://p/x.jpg');
    expect(out.post_title).toBe('Hero');
  });

  it('returns the input unchanged when it is not valid layout JSON', async () => {
    expect(await resolveLayoutImages('not json', searcher({}))).toBe('not json');
  });
});
