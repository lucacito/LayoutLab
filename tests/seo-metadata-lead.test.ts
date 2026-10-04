import { describe, it, expect } from 'vitest';
import { SITE_TITLE, SITE_META_DESCRIPTION } from '@/lib/site/brand';
import { metadata as hub } from '@/app/(marketing)/plugins/page';
import { metadata as product } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';
import { metadata as pricing } from '@/app/(catalog)/pricing/page';

const title = (m: { title?: unknown }) => (typeof m.title === 'string' ? m.title : (m.title as { default: string }).default);

describe('search snippets lead with the AI Editor', () => {
  // The root layout cannot be imported in a unit test (next/font), so the home page is checked through its source strings.
  const pages = { home: { title: SITE_TITLE, description: SITE_META_DESCRIPTION }, hub, product, pricing } as Record<string, { title?: unknown; description?: unknown }>;

  it.each(Object.entries(pages))('%s: a title and description that fit a result, and mention the AI Editor first', (_n, m) => {
    const t = title(m);
    const d = String(m.description);
    expect(t.length + ' | Divi5Lab'.length).toBeLessThanOrEqual(70);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(`${t} ${d}`).toMatch(/AI Editor|AI editor/);
    const ai = d.search(/AI Editor|AI editor/);
    const conv = d.search(/converter/i);
    if (conv >= 0 && ai >= 0) expect(ai).toBeLessThan(conv);
  });

  it('the plugin hub, the AI Editor page and pricing each declare a canonical', () => {
    for (const m of [hub, product, pricing]) expect(m.alternates?.canonical).toBeTruthy();
  });
});
