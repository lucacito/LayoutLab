import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

function rulesArray() {
  const { rules } = robots();
  return Array.isArray(rules) ? rules : [rules];
}

describe('robots', () => {
  it('keeps a wildcard rule that allows the site but hides private areas', () => {
    const wildcard = rulesArray().find((r) => r.userAgent === '*');
    expect(wildcard).toBeTruthy();
    expect(wildcard!.allow).toBe('/');
    expect(wildcard!.disallow).toEqual(expect.arrayContaining(['/admin', '/account', '/api']));
  });

  it('explicitly welcomes the major AI answer engines & training crawlers', () => {
    const agents = rulesArray().flatMap((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]));
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(agents).toContain(bot);
    }
  });

  it('never exposes private areas to AI bots either', () => {
    for (const r of rulesArray()) {
      if (r.userAgent !== '*') {
        expect(r.disallow).toEqual(expect.arrayContaining(['/admin', '/account', '/api']));
      }
    }
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toContain('/sitemap.xml');
  });
});
