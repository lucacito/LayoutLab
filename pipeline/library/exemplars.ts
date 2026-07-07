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

// Map a generation target type → library section kinds that teach it.
const KIND_BY_TYPE: Record<string, string[]> = {
  hero: ['hero'],
  cta: ['cta'],
  features: ['features', 'feature_detail'],
  cards: ['features'],
  pricing: ['pricing'],
  contact: ['contact'],
  gallery: ['gallery'],
  footer: ['cta', 'contact'],
  // testimonials/faq have no converted exemplars → return none, fall back to recipes.
  full_landing: ['hero', 'features', 'stats', 'pricing', 'cta'],
};

/** Top-K real section markups matching the target's type; prefer niche≈industry, then compact. */
export function getLibraryExemplars(target: Target, opts: { k?: number; maxChars?: number } = {}): string[] {
  const k = opts.k ?? 1;
  const maxChars = opts.maxChars ?? 6000;
  const kinds = KIND_BY_TYPE[target.type] ?? [];
  if (!kinds.length) return [];
  const niche = (target.niche ?? '').toLowerCase();
  const pool = load()
    .filter((e) => kinds.includes(e.kind) && e.chars <= maxChars)
    .sort((a, b) => {
      const am = a.industry.includes(niche) || niche.includes(a.industry) ? 0 : 1;
      const bm = b.industry.includes(niche) || niche.includes(b.industry) ? 0 : 1;
      return am - bm || a.chars - b.chars;
    });
  return pool.slice(0, k).map(
    (e) => `A REAL, validated Divi 5 ${e.kind} section (from a premium ${e.industry} ${e.pageType} layout) — imitate this real structure/attribute depth, but write your own copy:\n${e.markup}`,
  );
}

/** True when library few-shot is enabled for this run. */
export function libraryExemplarsEnabled(): boolean {
  return process.env.USE_LIBRARY_EXEMPLARS === '1';
}
