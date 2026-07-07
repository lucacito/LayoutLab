import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getLibraryExemplars,
  libraryExemplarsEnabled,
  KIND_BY_TYPE,
} from '@/pipeline/library/exemplars';
import { MATRIX, buildGenerationPrompt } from '@/pipeline/recipes';

// Snapshot/restore the two env vars this feature is gated by, so tests never leak
// state into each other (or into other test files run in the same worker).
const ENV_KEYS = ['USE_LIBRARY_EXEMPLARS', 'LIBRARY_EXEMPLAR_K', 'LIBRARY_EXEMPLAR_MAXCHARS'] as const;
let snapshot: Record<string, string | undefined>;
beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

describe('libraryExemplarsEnabled', () => {
  it('defaults ON when no env var is set', () => {
    expect(libraryExemplarsEnabled()).toBe(true);
  });
  it('disables when USE_LIBRARY_EXEMPLARS=0', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '0';
    expect(libraryExemplarsEnabled()).toBe(false);
  });
  it('stays on when explicitly set to 1 (kept for A/B override symmetry)', () => {
    process.env.USE_LIBRARY_EXEMPLARS = '1';
    expect(libraryExemplarsEnabled()).toBe(true);
  });
});

describe('getLibraryExemplars — k handling', () => {
  const target = { type: 'features', niche: 'saas', style: 'minimal' };
  it('defaults k to 2 when unspecified', () => {
    expect(getLibraryExemplars(target)).toHaveLength(2);
  });
  it('honors an explicit k, never returning more than requested', () => {
    expect(getLibraryExemplars(target, { k: 1 })).toHaveLength(1);
    expect(getLibraryExemplars(target, { k: 4 }).length).toBeLessThanOrEqual(4);
    expect(getLibraryExemplars(target, { k: 4 }).length).toBeGreaterThan(2); // pool is bigger than 2
  });
});

describe('getLibraryExemplars — every MATRIX type', () => {
  // testimonials/faq are a genuine, verified corpus gap: the 73-page D5 library
  // contains zero divi/testimonial and zero divi/toggle|accordion modules anywhere
  // (confirmed by direct grep of pipeline/library/d5/*.json). The only sections
  // whose page is literally titled "Testimonial Page" / that carry an "FAQ" heading
  // are empty shells (heading + generic filler text, no real quote/Q&A content) —
  // shipping those as "real structure to imitate" would teach the generator to
  // produce empty cards, which is worse than falling back to the curated recipes.
  const CORPUS_GAP_TYPES = new Set(['testimonials', 'faq']);

  it('resolves at least one real exemplar for every generatable MATRIX type not in the documented corpus gap', () => {
    const types = [...new Set(MATRIX.map((t) => t.type))];
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      const target = MATRIX.find((t) => t.type === type)!;
      const exemplars = getLibraryExemplars(target, { k: 3 });
      if (CORPUS_GAP_TYPES.has(type)) {
        expect(exemplars).toHaveLength(0);
      } else {
        expect(exemplars.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('logs a visible fallback line for the documented corpus-gap types', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const type of CORPUS_GAP_TYPES) {
      getLibraryExemplars({ type, niche: 'saas', style: 'minimal' });
    }
    const logged = spy.mock.calls.map((args) => String(args[0]));
    for (const type of CORPUS_GAP_TYPES) {
      expect(logged.some((l) => l.includes(type) && l.includes('fell back to zero exemplars'))).toBe(true);
    }
    spy.mockRestore();
  });
});

describe('KIND_BY_TYPE — unmapped-kind regression guard', () => {
  it('keeps every real, content-bearing corpus kind reachable from at least one generation target', () => {
    const idx = JSON.parse(readFileSync(join(process.cwd(), 'pipeline/library/index.json'), 'utf8')) as {
      exemplars: Array<{ kind: string; palette: Record<string, number> }>;
    };
    const kindsWithContent = new Set(
      idx.exemplars.filter((e) => Object.keys(e.palette).length > 0).map((e) => e.kind),
    );
    const reachable = new Set(Object.values(KIND_BY_TYPE).flat());
    // 'content'/'other' are intentionally-excluded low-signal catch-all buckets
    // (generic heading+text sections with no distinguishing module) — never
    // classified as a specific teachable kind, so deliberately left unmapped.
    const intentionallyUnmapped = new Set(['content', 'other', 'blog']);
    for (const kind of kindsWithContent) {
      if (intentionallyUnmapped.has(kind)) continue;
      expect(reachable.has(kind)).toBe(true);
    }
  });

  it('specifically reaches the previously-idle stats, media, and slider kinds', () => {
    const reachable = new Set(Object.values(KIND_BY_TYPE).flat());
    expect(reachable.has('stats')).toBe(true);
    expect(reachable.has('media')).toBe(true);
    expect(reachable.has('slider')).toBe(true);
    expect(KIND_BY_TYPE.gallery).toEqual(expect.arrayContaining(['gallery', 'media', 'slider']));
    expect(KIND_BY_TYPE.features).toEqual(expect.arrayContaining(['stats']));
    expect(KIND_BY_TYPE.full_landing).toEqual(expect.arrayContaining(['stats', 'contact']));
  });
});

describe('getLibraryExemplars — T3.4 BM25 retrieval keeps the kind gate', () => {
  it('a hero target never returns a non-hero-kind markup, even though BM25 ranks across the whole corpus', () => {
    const chosen = getLibraryExemplars({ type: 'hero', niche: 'fitness', style: 'minimal' }, { k: 5 });
    expect(chosen.length).toBeGreaterThan(0);
    for (const markup of chosen) expect(markup).toMatch(/Divi 5 hero section/);
  });

  it('a cta target never returns a non-cta-kind markup', () => {
    const chosen = getLibraryExemplars({ type: 'cta', niche: 'agency', style: 'bold' }, { k: 5 });
    expect(chosen.length).toBeGreaterThan(0);
    for (const markup of chosen) expect(markup).toMatch(/Divi 5 cta section/);
  });

  it('real-corpus sanity check: a fitness/hero query prefers a fitness-industry exemplar at k=1', () => {
    const [chosen] = getLibraryExemplars({ type: 'hero', niche: 'fitness', style: 'minimal' }, { k: 1 });
    expect(chosen).toMatch(/premium fitness/);
  });

  it('falls back to cross-kind BM25 (rather than returning nothing) only when the kind-filtered pool is empty', () => {
    // Temporarily map a synthetic type to a kind that does not exist anywhere in the
    // corpus, to exercise the "kind pool empty" branch without touching a real type.
    (KIND_BY_TYPE as Record<string, string[]>).__t34_test_kind__ = ['zzz-nonexistent-kind'];
    try {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const chosen = getLibraryExemplars({ type: '__t34_test_kind__', niche: 'fitness', style: 'minimal' }, { k: 2 });
      expect(chosen.length).toBeGreaterThan(0); // widened to the full corpus instead of returning []
      const logged = spy.mock.calls.map((args) => String(args[0]));
      expect(logged.some((l) => l.includes('cross-kind'))).toBe(true);
      spy.mockRestore();
    } finally {
      delete (KIND_BY_TYPE as Record<string, string[]>).__t34_test_kind__;
    }
  });

  it('is deterministic: the same target+k resolves to the same exemplar order every call', () => {
    const target = { type: 'features', niche: 'agency', style: 'minimal' };
    const a = getLibraryExemplars(target, { k: 4 });
    const b = getLibraryExemplars(target, { k: 4 });
    expect(a).toEqual(b);
  });
});

describe('buildGenerationPrompt — T1.1 acceptance criterion', () => {
  it('a hero/saas/minimal prompt contains a "Real-world example" block with NO env vars set', () => {
    const guide = { style: 'STYLE', schema: 'SCHEMA', examples: [] };
    const { prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(prompt).toMatch(/Real-world example/);
  });
});
