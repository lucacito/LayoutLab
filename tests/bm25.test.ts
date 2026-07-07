import { describe, it, expect } from 'vitest';
import { tokenize, buildBm25Index, scoreQuery } from '@/pipeline/library/bm25';

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Dental-Clinic Hero!')).toEqual(['dental', 'clinic', 'hero']);
  });
  it('returns an empty array for empty/whitespace input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('buildBm25Index', () => {
  const docs = [
    { key: 'a', text: 'hero dental clinic teeth smile' },
    { key: 'b', text: 'hero car wash detailing shine' },
  ];
  const idx = buildBm25Index(docs);

  it('counts document frequency per distinct term across the corpus', () => {
    expect(idx.df.hero).toBe(2); // appears in both docs
    expect(idx.df.dental).toBe(1); // appears only in doc a
  });

  it('records per-document term frequency and length', () => {
    expect(idx.tf.a.dental).toBe(1);
    expect(idx.docLen.a).toBe(5);
    expect(idx.docLen.b).toBe(5);
  });

  it('computes avgDocLen and corpus size', () => {
    expect(idx.n).toBe(2);
    expect(idx.avgDocLen).toBe(5);
  });

  it('defaults k1/b to the standard BM25 constants', () => {
    expect(idx.k1).toBeCloseTo(1.5);
    expect(idx.b).toBeCloseTo(0.75);
  });
});

describe('scoreQuery — labeled acceptance fixture (BM25 vs. substring match)', () => {
  // The old retrieval scored fit by `industry.includes(niche) || niche.includes(industry)`
  // over the bare industry slug. That rule is fooled by a same-string-different-meaning
  // collision: an unrelated "dental floss manufacturer" industry slug literally contains
  // the substring "dental", while a real "family dentistry" clinic's slug does not (it
  // reads "family-dentistry", which does NOT contain the contiguous substring "dental").
  const docs = [
    {
      key: 'floss-factory-hero', // WRONG match under old substring rule (industry slug contains "dental")
      text: 'home dental-floss-manufacturer hero heading text button bulk wholesale floss production line manufacturing supplies factory equipment orders',
    },
    {
      key: 'family-dentistry-hero', // the semantically-correct exemplar for "dental clinic hero"
      text: 'home family-dentistry hero heading text button your smile our priority book a dental checkup today gentle care for the whole family welcoming dental clinic for all ages',
    },
    {
      key: 'unrelated-hero', // shares no meaningful terms with the query at all
      text: 'home car-wash hero heading text button clean car detailing wash shine service book now schedule visit',
    },
  ];
  const idx = buildBm25Index(docs);

  it('the old substring rule would rank the floss factory ahead of the real dental clinic', () => {
    const niche = 'dental';
    const oldFit = (industry: string) => (industry.includes(niche) || niche.includes(industry) ? 0 : 1);
    expect(oldFit('dental-floss-manufacturer')).toBe(0); // false-positive match
    expect(oldFit('family-dentistry')).toBe(1); // false-negative: the real clinic is NOT matched
  });

  it('BM25 ranks the real dental clinic exemplar above the same-string false-positive', () => {
    const queryTerms = tokenize('dental clinic hero minimal');
    const scores = scoreQuery(idx, queryTerms);
    expect(scores['family-dentistry-hero']).toBeGreaterThan(scores['floss-factory-hero']);
    expect(scores['family-dentistry-hero']).toBeGreaterThan(scores['unrelated-hero']);
  });

  it('ranking by score (desc) puts the semantically-closest exemplar first', () => {
    const queryTerms = tokenize('dental clinic hero minimal');
    const scores = scoreQuery(idx, queryTerms);
    const ranked = [...docs].sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0));
    expect(ranked[0].key).toBe('family-dentistry-hero');
  });

  it('restricting candidate keys only scores/returns the requested subset', () => {
    const queryTerms = tokenize('dental clinic hero');
    const scores = scoreQuery(idx, queryTerms, ['floss-factory-hero', 'unrelated-hero']);
    expect(Object.keys(scores).sort()).toEqual(['floss-factory-hero', 'unrelated-hero']);
  });

  it('an empty query yields a zero score for every document', () => {
    const scores = scoreQuery(idx, []);
    for (const key of Object.keys(scores)) expect(scores[key]).toBe(0);
  });
});
