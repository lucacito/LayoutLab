// Retrieval over the converted D5 library corpus (pipeline/library/index.json):
// for a generation target, return the top-K real, validated section markups of a
// matching kind — few-shot into buildGenerationPrompt to teach the generator real
// structure. Gated by USE_LIBRARY_EXEMPLARS so it can be A/B'd.
//
// T3.4 — ranking within the kind gate is BM25 (lexical), not substring matching.
// Controller decision: BM25 over embeddings. Rationale: an embeddings call would
// need network/an API key at *some* point in the toolchain (even if only in the
// offline indexer), which conflicts with the CLI-only/zero-network spirit of this
// hardening pass and adds an external dependency; the brief explicitly sanctions
// "a strong lexical scheme like BM25 over the section's industry+kind+module-palette"
// as the no-network alternative. The BM25 corpus statistics (df/tf/docLen/avgDocLen)
// are precomputed OFFLINE by scripts/index-library.ts into pipeline/library/
// index-bm25.json; only the query-dependent scoring runs at generation time (see
// pipeline/library/bm25.ts for the pure scoring functions).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Target } from '@/pipeline/recipes/matrix';
import { scoreQuery, tokenize, type Bm25Index } from '@/pipeline/library/bm25';
import { SECTION_TYPES } from '@/pipeline/recipes/section-types';

interface Exemplar {
  slug: string; source: string; pageType: string; industry: string;
  sectionIndex: number; kind: string; palette: Record<string, number>; chars: number;
  key: string; descriptor: string; markup: string;
}

interface LibraryData {
  exemplars: Exemplar[];
  bm25: Bm25Index | null;
}

let cache: LibraryData | null = null;
function load(): LibraryData {
  if (cache) return cache;
  let exemplars: Exemplar[] = [];
  let bm25: Bm25Index | null = null;
  try {
    const idx = JSON.parse(readFileSync(join(process.cwd(), 'pipeline/library/index.json'), 'utf8')) as { exemplars?: Exemplar[] };
    // Drop empty/structural sections (no content modules) — useless as exemplars.
    exemplars = (idx.exemplars ?? []).filter((e) => Object.keys(e.palette).length > 0);
  } catch {
    exemplars = [];
  }
  try {
    bm25 = JSON.parse(readFileSync(join(process.cwd(), 'pipeline/library/index-bm25.json'), 'utf8')) as Bm25Index;
  } catch {
    // Missing/stale index-bm25.json degrades gracefully to a deterministic,
    // chars-ascending order (rankByBm25 below) rather than throwing — retrieval
    // still works, it just loses the relevance ranking until the index is rebuilt
    // (`bash scripts/index-library.sh`).
    bm25 = null;
  }
  cache = { exemplars, bm25 };
  return cache;
}

/** Stable per-exemplar key, matching what scripts/index-library.ts wrote into index-bm25.json. */
function keyOf(e: Exemplar): string {
  return e.key ?? `${e.slug}#${e.sectionIndex}`;
}

/** Query terms from the generation target: type/niche/style words + any directive keywords. */
function buildQueryTerms(target: Target): string[] {
  const parts = [target.type, target.niche, target.style, target.color, target.layout, target.variant?.group].filter(
    (v): v is string => Boolean(v),
  );
  return tokenize(parts.join(' '));
}

/** Rank a candidate pool by BM25 relevance to the query; deterministic tie-break on size. */
function rankByBm25(pool: Exemplar[], bm25: Bm25Index | null, queryTerms: string[]): Exemplar[] {
  if (!bm25 || !queryTerms.length) {
    // No BM25 signal available (index missing, or an empty query) — fall back to
    // the same deterministic "prefer compact" order the old byFit used as its
    // secondary sort key, so behavior degrades gracefully rather than randomly.
    return [...pool].sort((a, b) => a.chars - b.chars);
  }
  const scores = scoreQuery(bm25, queryTerms, pool.map(keyOf));
  return [...pool].sort((a, b) => {
    const diff = (scores[keyOf(b)] ?? 0) - (scores[keyOf(a)] ?? 0);
    return diff !== 0 ? diff : a.chars - b.chars;
  });
}

// Map a generation target type → library section kinds that teach it. Exported so
// tests can guard against a kind silently becoming unreachable again.
//
// testimonials/faq are a verified corpus gap, not a classifier bug: the 73-page D5
// library contains zero `divi/testimonial` and zero `divi/toggle`|`divi/accordion`
// modules anywhere (confirmed by grep across pipeline/library/d5/*.json). The only
// sections whose source page is literally titled "Testimonial Page" or that carry
// an "FAQ" heading are empty shells — an eyebrow + heading + generic filler text
// with NO real quote or Q&A content inside (the per-card columns are empty). Shipping
// those as "real structure to imitate" would teach the generator to produce empty
// testimonial/FAQ cards, which is worse than falling back to the curated recipes
// (RECIPE_BY_TYPE in prompts.ts already grounds these two types on real recipes).
// Left empty on purpose; see the fallback log in getLibraryExemplars below.
// T4.3: derived from the SECTION_TYPES registry (pipeline/recipes/section-types.ts)
// — was a hand-maintained literal; a plain, mutable object (not the registry
// itself) so existing test mutation (see tests/exemplars.test.ts's
// `__t34_test_kind__` scratch key) keeps working unchanged.
export const KIND_BY_TYPE: Record<string, string[]> = Object.fromEntries(
  Object.entries(SECTION_TYPES)
    .filter(([, entry]) => entry.libraryKinds !== undefined)
    .map(([type, entry]) => [type, entry.libraryKinds as string[]]),
);

/**
 * Top-K real section markups for the target's type. Blend (T3.4): the kind gate
 * runs FIRST — a hero target only ever ranks among hero-kind exemplars, never cta
 * or pricing — and BM25 ranks *within* that kind-filtered pool by relevance to the
 * target's type/niche/style words. Only when the kind-filtered pool is completely
 * empty (a mapped kind with zero surviving corpus members — not the same as a type
 * with NO mapped kind at all, e.g. testimonials/faq, which still short-circuit to
 * zero exemplars below) do we widen to BM25 over the FULL corpus, so a type that DOES
 * have a real mapped kind never silently returns nothing just because that exact
 * kind bucket is momentarily empty.
 */
export function getLibraryExemplars(target: Target, opts: { k?: number; maxChars?: number } = {}): string[] {
  const k = opts.k ?? 2;
  const maxChars = opts.maxChars ?? 6000;
  const kinds = KIND_BY_TYPE[target.type] ?? [];
  if (!kinds.length) {
    console.log(`[library] ${target.type} fell back to zero exemplars (no corpus kind mapped for this type)`);
    return [];
  }
  const { exemplars, bm25 } = load();
  const queryTerms = buildQueryTerms(target);
  let byKind = exemplars.filter((e) => kinds.includes(e.kind));
  const crossKindFallback = byKind.length === 0;
  if (crossKindFallback) byKind = exemplars;

  let pool = byKind.filter((e) => e.chars <= maxChars);
  // Some real kinds (e.g. pricing-table sections, which run ~11-12k chars) have NO
  // member under the compact default cap at all — don't zero out an otherwise-real,
  // available kind just because every instance is long; fall back to the smallest
  // real one(s) instead of injecting nothing.
  if (!pool.length && byKind.length) pool = byKind;

  const ranked = rankByBm25(pool, bm25, queryTerms);
  const chosen = ranked.slice(0, k);
  if (!chosen.length) {
    console.log(`[library] ${target.type} fell back to zero exemplars (no matching corpus sections ≤ ${maxChars} chars)`);
  } else {
    const kindNote = crossKindFallback ? `${kinds.join(', ')} (kind pool empty → cross-kind BM25 fallback)` : kinds.join(', ');
    console.log(`[library] ${target.type} (${target.niche}/${target.style}): injected ${chosen.length} exemplar(s) [kinds: ${kindNote}]`);
  }
  return chosen.map(
    (e) => `A REAL, validated Divi 5 ${e.kind} section (from a premium ${e.industry} ${e.pageType} layout) — imitate this real structure/attribute depth, but write your own copy:\n${e.markup}`,
  );
}

/** True when library few-shot is enabled for this run. ON by default — set
 *  USE_LIBRARY_EXEMPLARS=0 to disable (A/B against the curated-recipes-only path). */
export function libraryExemplarsEnabled(): boolean {
  return process.env.USE_LIBRARY_EXEMPLARS !== '0';
}
