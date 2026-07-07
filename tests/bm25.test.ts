import { describe, it, expect } from 'vitest';
import { tokenize, buildBm25Index, scoreQuery, idf } from '@/pipeline/library/bm25';

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

// Review finding: the labeled acceptance fixture above passes even with a
// numerator/denominator-swapped idf, because term-overlap count (how many
// query terms a doc contains at all) dominates the outcome there — the fixture
// never isolates idf as the deciding factor. These tests pin idf's DIRECTION
// directly (rare terms must score higher than common terms) and then rig a
// ranking scenario where idf, not term-overlap count, is the only thing that
// can decide the winner — so a swapped formula fails these specifically.
describe('idf — direction pinned (rare terms outrank common terms)', () => {
  it('a term appearing in 1 of 337 docs scores higher than one appearing in 300 of 337', () => {
    const rare = idf(337, 1);
    const common = idf(337, 300);
    expect(rare).toBeGreaterThan(common);
    // Approximate expected values (ln((n-df+0.5)/(df+0.5)+1)) — pins the actual
    // magnitude, not just the ">" direction, so a swap can't accidentally pass
    // by producing some other-but-still-ordered pair of numbers.
    expect(rare).toBeCloseTo(5.418, 2);
    expect(common).toBeCloseTo(0.118, 2);
  });

  it('idf decreases monotonically as df rises from 0 to n', () => {
    const n = 50;
    const values = [0, 1, 5, 10, 25, 40, 49, 50].map((df) => idf(n, df));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
  });
});

describe('scoreQuery — idf must break ties when term-overlap COUNT is equal (regression net)', () => {
  // 11 docs, all the same length (4 tokens), so BM25's length-normalization term
  // is identical for every doc — isolating idf as the only thing that can move
  // the score. Doc "rare-term-doc" contains a term that appears in only 1 of 11
  // docs; doc "common-term-doc" contains a *different* term that appears in 10
  // of 11 docs. Both docs match exactly ONE of the two query terms (equal
  // overlap COUNT), so a naive "count how many query terms matched" signal sees
  // them as tied — only idf can decide the winner. Under a numerator/denominator
  // swap, common-term-doc would win instead.
  const docs = [
    { key: 'rare-term-doc', text: 'rareterm filler filler filler' },
    { key: 'common-term-doc', text: 'commonterm filler filler filler' },
    ...Array.from({ length: 9 }, (_, i) => ({ key: `padding-${i}`, text: 'commonterm padding padding padding' })),
  ];
  const idx = buildBm25Index(docs);

  it('corpus sanity: rareterm df=1, commonterm df=10, all docs length 4', () => {
    expect(idx.n).toBe(11);
    expect(idx.df.rareterm).toBe(1);
    expect(idx.df.commonterm).toBe(10);
    expect(idx.avgDocLen).toBe(4);
  });

  it('rare-term-doc and common-term-doc match the SAME NUMBER (1) of query terms', () => {
    const matched = (text: string) => ['rareterm', 'commonterm'].filter((t) => text.split(' ').includes(t)).length;
    expect(matched(docs[0].text)).toBe(1);
    expect(matched(docs[1].text)).toBe(1);
  });

  it('the rare-term doc outranks the common-term doc despite equal term-overlap count', () => {
    const scores = scoreQuery(idx, tokenize('rareterm commonterm'), ['rare-term-doc', 'common-term-doc']);
    expect(scores['rare-term-doc']).toBeGreaterThan(scores['common-term-doc']);
  });
});
