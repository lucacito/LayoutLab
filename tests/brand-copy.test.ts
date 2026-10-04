import { describe, expect, it } from 'vitest';
import { SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, SOCIAL_DESCRIPTION } from '@/lib/site/brand';
import { GET } from '@/app/llms.txt/route';

describe('site positioning copy', () => {
  it('leads every site-wide description with the AI Editor for Divi 5', () => {
    for (const s of [SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, SOCIAL_DESCRIPTION]) {
      expect(s).toMatch(/divi 5/i);
    }
    expect(SITE_TITLE).toMatch(/^Divi 5 AI Editor/);
    // title + ' | Divi5Lab' stays within what Google shows in a result
    expect(`${SITE_TITLE} | Divi5Lab`.length).toBeLessThanOrEqual(65);
    expect(SITE_DESCRIPTION).toMatch(/^Divi5Lab is home to the AI Editor/);
    expect(SITE_TAGLINE).toMatch(/^The AI Editor for Divi 5/);
    expect(SITE_DESCRIPTION).toMatch(/deterministic validator/i);
  });

  it('still mentions the converters, after the AI Editor', () => {
    for (const builder of [/elementor/i, /beaver builder/i, /wpbakery/i]) {
      expect(SITE_DESCRIPTION).toMatch(builder);
      expect(SITE_TAGLINE).toMatch(builder);
    }
    expect(SITE_DESCRIPTION.search(/AI Editor/)).toBeLessThan(SITE_DESCRIPTION.search(/converters/i));
  });

  it('tells AI agents the same story in llms.txt', async () => {
    const body = await GET().text();
    const summary = body.split('\n').find((line) => line.startsWith('> ')) ?? '';
    expect(summary).toMatch(/^> Divi5Lab is home to the AI Editor for Divi 5/);
    expect(summary).toMatch(/wpbakery/i);
    expect(body.indexOf('/plugins/divi-5-ai-editor')).toBeLessThan(body.indexOf('/plugins/wpbakery-to-divi-5'));
  });
});
