// Pure BM25 (Okapi) scoring — no I/O, no network, no LLM. Used two ways:
//  1. OFFLINE, by scripts/index-library.ts: build an index over every exemplar's
//     descriptor text and serialize the corpus-side statistics (df/tf/docLen/avgDocLen)
//     to pipeline/library/index-bm25.json.
//  2. AT RUNTIME, by pipeline/library/exemplars.ts: load that precomputed index and
//     score it against a query built from the generation target (type/niche/style/
//     directive words) — only the query-dependent part (which cannot be precomputed)
//     runs at generation time.
//
// This is T3.4's chosen "no-network alternative" to embeddings (see exemplars.ts):
// zero external deps, deterministic, offline-buildable, and the brief explicitly
// sanctions "a strong lexical scheme like BM25 over the section's industry+kind+
// module-palette" as the alternative to an embeddings API call.

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export interface Bm25Doc {
  key: string;
  text: string;
}

export interface Bm25Index {
  k1: number;
  b: number;
  n: number;
  avgDocLen: number;
  /** document key -> token count */
  docLen: Record<string, number>;
  /** term -> number of documents containing it */
  df: Record<string, number>;
  /** document key -> term -> count within that document */
  tf: Record<string, Record<string, number>>;
}

/** Build the corpus-side BM25 statistics. Deterministic; safe to run offline/repeatedly. */
export function buildBm25Index(docs: Bm25Doc[], opts: { k1?: number; b?: number } = {}): Bm25Index {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;
  const docLen: Record<string, number> = {};
  const tf: Record<string, Record<string, number>> = {};
  const df: Record<string, number> = {};
  let totalLen = 0;
  for (const { key, text } of docs) {
    const tokens = tokenize(text);
    docLen[key] = tokens.length;
    totalLen += tokens.length;
    const counts: Record<string, number> = {};
    for (const t of tokens) counts[t] = (counts[t] ?? 0) + 1;
    tf[key] = counts;
    for (const t of Object.keys(counts)) df[t] = (df[t] ?? 0) + 1;
  }
  const n = docs.length;
  return { k1, b, n, avgDocLen: n ? totalLen / n : 0, docLen, df, tf };
}

function idf(index: Bm25Index, term: string): number {
  const dfT = index.df[term] ?? 0;
  // BM25+ style idf (the "+1" inside the log) keeps the value non-negative even
  // when a term appears in the majority of documents.
  return Math.log((index.n - dfT + 0.5) / (dfT + 0.5) + 1);
}

/**
 * Score every document in `keys` (default: the whole index) against `queryTerms`.
 * Pass a restricted `keys` list to score only a candidate subset (e.g. a kind-gated
 * pool) while still using the full corpus's df/avgDocLen statistics.
 */
export function scoreQuery(index: Bm25Index, queryTerms: string[], keys?: string[]): Record<string, number> {
  const candidateKeys = keys ?? Object.keys(index.docLen);
  const uniqueTerms = [...new Set(queryTerms)];
  const scores: Record<string, number> = {};
  for (const key of candidateKeys) {
    let score = 0;
    const len = index.docLen[key] ?? 0;
    const counts = index.tf[key] ?? {};
    for (const term of uniqueTerms) {
      const f = counts[term] ?? 0;
      if (!f) continue;
      const num = f * (index.k1 + 1);
      const den = f + index.k1 * (1 - index.b + index.b * (len / (index.avgDocLen || 1)));
      score += idf(index, term) * (num / den);
    }
    scores[key] = score;
  }
  return scores;
}
