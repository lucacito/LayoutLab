import { describe, expect, it } from 'vitest';
import { KEYWORD_PAGES, getKeywordPage, listKeywordPages } from '@/lib/seo/keyword-pages';
import { AXIS_VALUES } from '@/lib/catalog/filters';

// Top-level path segments already owned by real routes. A keyword slug that
// collides would be shadowed (static routes win) — the registry entry would be
// silently unreachable, so we fail loudly here instead.
const RESERVED = [
  'browse', 'layouts', 'packs', 'pricing', 'saved', 'type', 'niche', 'style', 'color',
  'about', 'contact', 'license', 'account', 'login', 'verify-request', 'admin', 'api',
  'checkout', 'guides', 'free', 'sitemap.xml', 'robots.txt', 'llms.txt',
];

const pages = Object.values(KEYWORD_PAGES);

describe('keyword page registry', () => {
  it('has the 13 planned pages', () => {
    expect(pages.length).toBe(13);
  });

  it('slugs are kebab-case, unique, keyed consistently, and never shadow real routes', () => {
    const slugs = pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const [key, page] of Object.entries(KEYWORD_PAGES)) {
      expect(key).toBe(page.slug);
      expect(page.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(RESERVED).not.toContain(page.slug);
    }
  });

  it('filters reference real axis values only', () => {
    for (const p of pages) {
      for (const t of p.filters.type ?? []) expect(AXIS_VALUES.type).toContain(t);
      for (const n of p.filters.niche ?? []) expect(AXIS_VALUES.niche).toContain(n);
      for (const s of p.filters.style ?? []) expect(AXIS_VALUES.style).toContain(s);
    }
  });

  it('meta lengths are within SERP-friendly bounds', () => {
    for (const p of pages) {
      expect(p.metaTitle.length, `${p.slug} metaTitle`).toBeLessThanOrEqual(65);
      expect(p.metaDescription.length, `${p.slug} metaDescription`).toBeGreaterThanOrEqual(100);
      expect(p.metaDescription.length, `${p.slug} metaDescription`).toBeLessThanOrEqual(165);
    }
  });

  it('intro copy is substantial (≥ 200 words) and h1/faq present', () => {
    for (const p of pages) {
      const words = p.intro.trim().split(/\s+/).length;
      expect(words, `${p.slug} intro words`).toBeGreaterThanOrEqual(200);
      expect(p.h1.length).toBeGreaterThan(8);
      expect(p.faq.length).toBeGreaterThanOrEqual(3);
      for (const f of p.faq) {
        expect(f.question.endsWith('?')).toBe(true);
        expect(f.answer.length).toBeGreaterThan(40);
      }
    }
  });

  it('related slugs resolve within the registry', () => {
    for (const p of pages) {
      expect(p.related.length).toBeGreaterThanOrEqual(2);
      for (const r of p.related) {
        expect(r).not.toBe(p.slug);
        expect(getKeywordPage(r), `${p.slug} → ${r}`).toBeDefined();
      }
    }
  });

  it('getKeywordPage returns undefined for unknown slugs', () => {
    expect(getKeywordPage('definitely-not-a-page')).toBeUndefined();
  });

  it('no keyword page sells packs or membership anymore', () => {
    for (const page of listKeywordPages()) {
      const text = JSON.stringify(page).toLowerCase();
      expect(text).not.toMatch(/all-access|membership/);
    }
  });
});
