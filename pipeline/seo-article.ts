import type { LlmClient } from './llm';
import { extractJson } from './llm';

/** Long-form on-page SEO content for one layout — mirrors the shape stored in
 * `layouts.seo.article` (db/schema.ts) and rendered by
 * `components/LayoutArticle.tsx`. Generated for new layouts by the pipeline's
 * SEO phase and for existing rows by scripts/backfill-seo-articles.ts. */
export interface LayoutArticle {
  overview: string;
  features: string[];
  whoItsFor: string;
  customization: string;
  faq: { q: string; a: string }[];
}

export interface ArticleMeta {
  metaTitle: string;
  metaDescription: string;
}

export interface ArticleInput {
  title: string;
  type: string;
  niche: string;
  style: string;
  /** Paid-only layouts must not promise a free download in copy. */
  paid: boolean;
  layoutJson: string;
}

export interface GenerateArticleResult {
  article: LayoutArticle;
  meta: ArticleMeta;
  retried: boolean;
  /** True when the retry also missed the quality floor. Caller decides whether
   * to ship the content anyway (pipeline) or keep the existing row (backfill). */
  floorMissed: boolean;
}

// Quality floors — SERP-shaped, checked after parse; one correction retry.
export const ARTICLE_MIN_OVERVIEW_CHARS = 900;
export const ARTICLE_FEATURES_RANGE: [number, number] = [5, 8];
export const ARTICLE_FAQ_RANGE: [number, number] = [3, 6];
export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_RANGE: [number, number] = [120, 158];

const SYSTEM =
  'You write on-page SEO content for a Divi 5 layout product page. Respond with ONLY a JSON object: ' +
  '{ "article": { "overview", "features": string[], "whoItsFor", "customization", "faq": [{"q","a"}] }, ' +
  '"meta": { "metaTitle", "metaDescription" } }. ' +
  'overview/whoItsFor/customization are markdown (paragraphs; no headings — the page supplies them). ' +
  'Write like a designer explaining real decisions, not a keyword stuffer. Never invent ratings, review counts, or Divi features you are not sure of.';

export function buildArticlePrompt(i: ArticleInput): { system: string; user: string } {
  const availability = i.paid
    ? 'This layout is part of a PAID pack — never call the download free; the page sells the pack.'
    : 'This layout is a free download (email-gated), with a commercial license included.';
  const user = [
    `Write the product-page content for the Divi 5 layout "${i.title}" — a ${i.style} ${i.type} section for the ${i.niche} niche.`,
    availability,
    '',
    'Requirements:',
    `- overview: ${ARTICLE_MIN_OVERVIEW_CHARS}+ characters of markdown (2–4 paragraphs) explaining the design: structure, hierarchy, spacing, palette role, mobile behavior. Ground every claim in the actual layout JSON below.`,
    `- features: ${ARTICLE_FEATURES_RANGE[0]}–${ARTICLE_FEATURES_RANGE[1]} concrete bullets (what modules/structure the buyer actually gets — no fluff like "beautiful design").`,
    '- whoItsFor: 60–150 words on the industries/use cases this genuinely fits.',
    '- customization: 80–200 words of practical tips (preset-level palette changes, copy length limits, image aspect ratios).',
    `- faq: ${ARTICLE_FAQ_RANGE[0]}–${ARTICLE_FAQ_RANGE[1]} layout-SPECIFIC questions and honest answers (responsiveness, modules used, imagery, what to edit first). Do NOT include generic license/Divi-version questions — the page adds those.`,
    `- meta.metaTitle: ≤ ${META_TITLE_MAX} chars, must contain "Divi 5" and the layout's type or niche, front-load the search phrase.`,
    `- meta.metaDescription: ${META_DESCRIPTION_RANGE[0]}–${META_DESCRIPTION_RANGE[1]} chars, benefit-led with a call to action (mention: native Divi 5 modules, responsive, ${i.paid ? 'commercial license' : 'free download'}).`,
    '',
    'Layout JSON:',
    i.layoutJson,
  ].join('\n');
  return { system: SYSTEM, user };
}

export function parseArticleResponse(text: string): { article: LayoutArticle; meta: ArticleMeta } {
  const raw = extractJson(text) as Record<string, unknown>;
  const a = raw.article as Record<string, unknown> | undefined;
  const m = raw.meta as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') throw new Error('article missing');
  if (!m || typeof m !== 'object') throw new Error('meta missing');
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} missing/empty`);
    return v.trim();
  };
  const features = Array.isArray(a.features) ? a.features.filter((f): f is string => typeof f === 'string' && !!f.trim()) : [];
  const faq = (Array.isArray(a.faq) ? a.faq : [])
    .filter((f): f is { q: string; a: string } =>
      !!f && typeof f === 'object' && typeof (f as Record<string, unknown>).q === 'string' && typeof (f as Record<string, unknown>).a === 'string')
    .map((f) => ({ q: f.q.trim(), a: f.a.trim() }));
  return {
    article: {
      overview: str(a.overview, 'overview'),
      features,
      whoItsFor: str(a.whoItsFor, 'whoItsFor'),
      customization: str(a.customization, 'customization'),
      faq,
    },
    meta: {
      metaTitle: str(m.metaTitle, 'metaTitle'),
      metaDescription: str(m.metaDescription, 'metaDescription'),
    },
  };
}

export function meetsArticleFloor(p: { article: LayoutArticle; meta: ArticleMeta }): boolean {
  const { article, meta } = p;
  return (
    article.overview.length >= ARTICLE_MIN_OVERVIEW_CHARS &&
    article.features.length >= ARTICLE_FEATURES_RANGE[0] &&
    article.features.length <= ARTICLE_FEATURES_RANGE[1] &&
    article.faq.length >= ARTICLE_FAQ_RANGE[0] &&
    article.faq.length <= ARTICLE_FAQ_RANGE[1] &&
    meta.metaTitle.length <= META_TITLE_MAX &&
    /divi 5/i.test(meta.metaTitle) &&
    meta.metaDescription.length >= META_DESCRIPTION_RANGE[0] &&
    meta.metaDescription.length <= META_DESCRIPTION_RANGE[1]
  );
}

function floorViolations(p: { article: LayoutArticle; meta: ArticleMeta }): string[] {
  const v: string[] = [];
  const { article, meta } = p;
  if (article.overview.length < ARTICLE_MIN_OVERVIEW_CHARS)
    v.push(`overview must be ≥ ${ARTICLE_MIN_OVERVIEW_CHARS} chars (got ${article.overview.length})`);
  if (article.features.length < ARTICLE_FEATURES_RANGE[0] || article.features.length > ARTICLE_FEATURES_RANGE[1])
    v.push(`features must have ${ARTICLE_FEATURES_RANGE[0]}–${ARTICLE_FEATURES_RANGE[1]} items (got ${article.features.length})`);
  if (article.faq.length < ARTICLE_FAQ_RANGE[0] || article.faq.length > ARTICLE_FAQ_RANGE[1])
    v.push(`faq must have ${ARTICLE_FAQ_RANGE[0]}–${ARTICLE_FAQ_RANGE[1]} items (got ${article.faq.length})`);
  if (meta.metaTitle.length > META_TITLE_MAX) v.push(`metaTitle must be ≤ ${META_TITLE_MAX} chars (got ${meta.metaTitle.length})`);
  if (!/divi 5/i.test(meta.metaTitle)) v.push('metaTitle must contain "Divi 5"');
  if (meta.metaDescription.length < META_DESCRIPTION_RANGE[0] || meta.metaDescription.length > META_DESCRIPTION_RANGE[1])
    v.push(`metaDescription must be ${META_DESCRIPTION_RANGE[0]}–${META_DESCRIPTION_RANGE[1]} chars (got ${meta.metaDescription.length})`);
  return v;
}

export async function generateLayoutArticle(
  input: ArticleInput,
  deps: { llm: LlmClient; maxBudgetUsd?: number; log?: (msg: string) => void },
): Promise<GenerateArticleResult> {
  const log = deps.log ?? (() => {});
  const { system, user } = buildArticlePrompt(input);

  const attempt = async (prompt: string) => {
    const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
    return parseArticleResponse(text);
  };

  let parsed = await attempt(user);
  let retried = false;

  if (!meetsArticleFloor(parsed)) {
    retried = true;
    const retryPrompt = [
      user,
      '',
      'Your previous response did not meet the required quality bar:',
      floorViolations(parsed).map((m) => `- ${m}`).join('\n'),
      '',
      'Respond again with ONLY a corrected JSON object meeting every requirement above.',
    ].join('\n');
    parsed = await attempt(retryPrompt);
  }

  const floorMissed = !meetsArticleFloor(parsed);
  if (floorMissed) {
    log(`[seo-article] quality floor still unmet after retry for "${input.title}": ${floorViolations(parsed).join('; ')}`);
  }

  return { ...parsed, retried, floorMissed };
}
