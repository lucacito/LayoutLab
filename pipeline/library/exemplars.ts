// Retrieval over the converted D5 library corpus (pipeline/library/index.json):
// for a generation target, return the top-K real, validated section markups of a
// matching kind — few-shot into buildGenerationPrompt to teach the generator real
// structure. Gated by USE_LIBRARY_EXEMPLARS so it can be A/B'd.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Target } from '@/pipeline/recipes/matrix';

interface Exemplar {
  slug: string; source: string; pageType: string; industry: string;
  kind: string; palette: Record<string, number>; chars: number; markup: string;
}

let cache: Exemplar[] | null = null;
function load(): Exemplar[] {
  if (cache) return cache;
  try {
    const idx = JSON.parse(readFileSync(join(process.cwd(), 'pipeline/library/index.json'), 'utf8')) as { exemplars?: Exemplar[] };
    // Drop empty/structural sections (no content modules) — useless as exemplars.
    cache = (idx.exemplars ?? []).filter((e) => Object.keys(e.palette).length > 0);
  } catch {
    cache = [];
  }
  return cache;
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
export const KIND_BY_TYPE: Record<string, string[]> = {
  hero: ['hero'],
  cta: ['cta'],
  features: ['features', 'feature_detail', 'stats'],
  cards: ['features'],
  pricing: ['pricing'],
  contact: ['contact'],
  gallery: ['gallery', 'media', 'slider'],
  footer: ['cta', 'contact'],
  testimonials: [],
  faq: [],
  full_landing: ['hero', 'features', 'stats', 'pricing', 'cta', 'contact'],
};

/** Top-K real section markups matching the target's type; prefer niche≈industry, then compact. */
export function getLibraryExemplars(target: Target, opts: { k?: number; maxChars?: number } = {}): string[] {
  const k = opts.k ?? 2;
  const maxChars = opts.maxChars ?? 6000;
  const kinds = KIND_BY_TYPE[target.type] ?? [];
  if (!kinds.length) {
    console.log(`[library] ${target.type} fell back to zero exemplars (no corpus kind mapped for this type)`);
    return [];
  }
  const niche = (target.niche ?? '').toLowerCase();
  const byKind = load().filter((e) => kinds.includes(e.kind));
  const byFit = (a: Exemplar, b: Exemplar) => {
    const am = a.industry.includes(niche) || niche.includes(a.industry) ? 0 : 1;
    const bm = b.industry.includes(niche) || niche.includes(b.industry) ? 0 : 1;
    return am - bm || a.chars - b.chars;
  };
  let pool = byKind.filter((e) => e.chars <= maxChars).sort(byFit);
  // Some real kinds (e.g. pricing-table sections, which run ~11-12k chars) have NO
  // member under the compact default cap at all — don't zero out an otherwise-real,
  // available kind just because every instance is long; fall back to the smallest
  // real one(s) instead of injecting nothing.
  if (!pool.length && byKind.length) pool = [...byKind].sort(byFit);
  const chosen = pool.slice(0, k);
  if (!chosen.length) {
    console.log(`[library] ${target.type} fell back to zero exemplars (no matching corpus sections ≤ ${maxChars} chars)`);
  } else {
    console.log(`[library] ${target.type} (${target.niche}/${target.style}): injected ${chosen.length} exemplar(s) [kinds: ${kinds.join(', ')}]`);
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
