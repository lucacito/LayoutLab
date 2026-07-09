import { describe, expect, it } from 'vitest';
import { parseFrontmatter, listGuides, getGuide } from '@/lib/guides';

describe('parseFrontmatter', () => {
  it('parses keys, quoted values, comma lists, and returns the body', () => {
    const raw = `---
title: "Divi 5 vs Elementor: Templates Compared"
description: An honest comparison.
date: 2026-07-08
keywords: divi 5, elementor, templates
---

# Heading

Body text here.`;
    const { data, body } = parseFrontmatter(raw);
    expect(data.title).toBe('Divi 5 vs Elementor: Templates Compared');
    expect(data.description).toBe('An honest comparison.');
    expect(data.date).toBe('2026-07-08');
    expect(data.keywords).toEqual(['divi 5', 'elementor', 'templates']);
    expect(body.trim().startsWith('# Heading')).toBe(true);
  });

  it('throws on missing frontmatter block', () => {
    expect(() => parseFrontmatter('no frontmatter at all')).toThrow();
  });
});

describe('guides content', () => {
  it('lists guides sorted newest first with complete frontmatter', () => {
    const guides = listGuides();
    expect(guides.length).toBeGreaterThanOrEqual(8);
    for (const g of guides) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.title.length).toBeGreaterThan(10);
      expect(g.description.length).toBeGreaterThanOrEqual(80);
      expect(g.description.length).toBeLessThanOrEqual(165);
      expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(g.keywords.length).toBeGreaterThanOrEqual(2);
      expect(g.body.trim().split(/\s+/).length, `${g.slug} word count`).toBeGreaterThanOrEqual(700);
    }
    const dates = guides.map((g) => g.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('every internal link in guide bodies targets a real route family', () => {
    const okPrefixes = [
      '/browse', '/layouts/', '/packs', '/pricing', '/license', '/about', '/contact', '/free',
      '/type/', '/niche/', '/style/', '/color/', '/guides', '/divi-', '/free-divi-', '/elegant-themes-layouts',
    ];
    for (const g of listGuides()) {
      const links = [...g.body.matchAll(/\]\((\/[^)#\s]*)/g)].map((m) => m[1]);
      expect(links.length, `${g.slug} internal links`).toBeGreaterThanOrEqual(6);
      for (const href of links) {
        expect(okPrefixes.some((p) => href === p.replace(/\/$/, '') || href.startsWith(p)), `${g.slug} → ${href}`).toBe(true);
      }
    }
  });

  it('getGuide returns undefined for unknown slugs', () => {
    expect(getGuide('nope-not-real')).toBeUndefined();
  });
});
