import { describe, expect, it } from 'vitest';
import { SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, SOCIAL_DESCRIPTION } from '@/lib/site/brand';
import { GET } from '@/app/llms.txt/route';

describe('site positioning copy', () => {
  it('leads every site-wide description with converting to Divi 5', () => {
    expect(SITE_TITLE).toMatch(/convert .* to divi 5/i);
    for (const s of [SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, SOCIAL_DESCRIPTION]) {
      expect(s).toMatch(/divi 5/i);
    }
    for (const builder of [/elementor/i, /beaver builder/i, /wpbakery/i]) {
      expect(SITE_DESCRIPTION).toMatch(builder);
      expect(SITE_TAGLINE).toMatch(builder);
    }
  });

  it('tells AI agents the same story in llms.txt', async () => {
    const body = await GET().text();
    const summary = body.split('\n').find((line) => line.startsWith('> ')) ?? '';
    expect(summary).toMatch(/convert/i);
    expect(summary).toMatch(/wpbakery/i);
    expect(body).toMatch(/\/plugins\/wpbakery-to-divi-5/);
  });
});
