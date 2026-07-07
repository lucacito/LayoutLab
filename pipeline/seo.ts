import type { LlmClient } from './llm';
import { extractJson } from './llm';
import type { Target } from './recipes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

export interface LayoutSeo {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  axes: { type: string; niche: string; style: string; colors: string[] };
}

/** T2.4: a single axis/color value the model proposed that didn't survive
 * `clampOne`/`clampMany` and was silently reverted — until now. Surfacing
 * this is a QA signal: the model disagreeing with the assigned taxonomy
 * often means the render doesn't match the target. `proposed` is whatever
 * the model returned (kept as `unknown` — it may not even have been a
 * string/array); `clamped` is the value that actually shipped. */
export interface SeoClamp {
  axis: 'type' | 'niche' | 'style' | 'colors';
  proposed: unknown;
  clamped: string | string[];
}

/** T2.4: `generateSeo`'s return is a strict superset of `LayoutSeo` — every
 * existing consumer that reads `seo.title`/`seo.slug`/`seo.axes`/etc. keeps
 * working unchanged; the new fields are additive instrumentation for the
 * quality floor + clamp-visibility gate (see the T2.4 brief). */
export interface GenerateSeoResult extends LayoutSeo {
  /** True when metaDescription/keywords still didn't meet the minimum
   * quality floor after the one allowed retry. NOT a drop gate — the brief
   * calls for "logged/flagged", so the layout still ships with whatever
   * metadata the model produced; callers (pipeline/run.ts) surface this via
   * a `seo_floor_miss` RunEvent instead of dropping the target. */
  seoFloorMissed: boolean;
  /** True if the first response missed the floor and a retry was attempted
   * (regardless of whether the retry itself met the floor). */
  seoRetried: boolean;
  /** Every axis/color clamp applied to the FINAL (post-retry, if any)
   * response. Empty when the model's axes matched the enum throughout. */
  seoClamps: SeoClamp[];
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Minimum `metaDescription` length (characters, trimmed) below which the SEO
 * step retries once before flagging. 70 is a low-but-real floor: long enough
 * to rule out a one-line stub ("A nice hero.") without forcing a specific SEO
 * meta-description length convention (~150-160 chars) that would make the
 * floor itself a frequent false-positive trigger. Tunable via env
 * `SEO_MIN_META_DESCRIPTION_LENGTH` — see `seoMinMetaDescriptionLength`. */
export const DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH = 70;

/** Minimum keyword count below which the SEO step retries once before
 * flagging. Tunable via env `SEO_MIN_KEYWORDS` — see `seoMinKeywords`. */
export const DEFAULT_SEO_MIN_KEYWORDS = 3;

/** Tunable via env `SEO_MIN_META_DESCRIPTION_LENGTH` (default 70 — see the
 * rationale above `DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH`). Falls back to
 * the default on missing/non-numeric/negative values rather than throwing —
 * a misconfigured env var must not crash the pipeline (mirrors
 * `pipeline/dedupe.ts`'s `perceptualDupeMaxDistance`). */
export function seoMinMetaDescriptionLength(): number {
  const raw = process.env.SEO_MIN_META_DESCRIPTION_LENGTH;
  if (raw === undefined) return DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SEO_MIN_META_DESCRIPTION_LENGTH;
}

/** Tunable via env `SEO_MIN_KEYWORDS` (default 3). Same missing/non-numeric/
 * negative fallback behavior as `seoMinMetaDescriptionLength`. */
export function seoMinKeywords(): number {
  const raw = process.env.SEO_MIN_KEYWORDS;
  if (raw === undefined) return DEFAULT_SEO_MIN_KEYWORDS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SEO_MIN_KEYWORDS;
}

/** Clamp a single axis value to the allowed enum, falling back to the
 * target's own value when the model's proposal is missing/off-enum. Returns
 * the clamp record (T2.4) when a fallback was actually applied — `undefined`
 * when the proposed value was already valid, so callers can tell "matched"
 * apart from "disagreed and got reverted" without re-deriving it. */
function clampOne(
  value: unknown,
  allowed: readonly string[],
  fallback: string,
  axis: SeoClamp['axis'],
): { value: string; clamp?: SeoClamp } {
  if (typeof value === 'string' && allowed.includes(value)) return { value };
  return { value: fallback, clamp: { axis, proposed: value, clamped: fallback } };
}

/** Clamp an array of proposed colors to the allowed enum, dropping any
 * off-enum entries. Returns a clamp record (T2.4) only when at least one
 * entry was actually filtered out — an already-clean (or empty/absent) list
 * is not a clamp. */
function clampMany(value: unknown, allowed: readonly string[]): { value: string[]; clamp?: SeoClamp } {
  if (!Array.isArray(value)) return { value: [] };
  const filtered = value.filter((v): v is string => typeof v === 'string' && allowed.includes(v));
  if (filtered.length !== value.length) {
    return { value: filtered, clamp: { axis: 'colors', proposed: value, clamped: filtered } };
  }
  return { value: filtered };
}

const SYSTEM =
  'You write SEO metadata for a Divi 5 layout. Respond with ONLY a JSON object: ' +
  '{ "title", "metaDescription", "keywords": string[], "axes": { "type","niche","style","colors": string[] } }.';

function buildSeoPrompt(json: string, target: Target): string {
  return [
    `Write SEO metadata for this Divi 5 ${target.type} layout (niche: ${target.niche}, style: ${target.style}).`,
    `Allowed axis values — type: ${AXIS_VALUES.type.join(', ')}; niche: ${AXIS_VALUES.niche.join(', ')}; style: ${AXIS_VALUES.style.join(', ')}; colors: ${AXIS_VALUES.color.join(', ')}.`,
    'Layout JSON:',
    json,
  ].join('\n');
}

interface ParsedSeo {
  title: string;
  metaDescription: string;
  keywords: string[];
  axes: { type: string; niche: string; style: string; colors: string[] };
  clamps: SeoClamp[];
}

function parseSeoResponse(text: string, target: Target): ParsedSeo {
  const raw = extractJson(text) as Record<string, unknown>;
  const axes = (raw.axes ?? {}) as Record<string, unknown>;

  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `${target.style} ${target.niche} ${target.type}`;

  const type = clampOne(axes.type, AXIS_VALUES.type, target.type, 'type');
  const niche = clampOne(axes.niche, AXIS_VALUES.niche, target.niche, 'niche');
  const style = clampOne(axes.style, AXIS_VALUES.style, target.style, 'style');
  const colors = clampMany(axes.colors, AXIS_VALUES.color);
  const clamps = [type.clamp, niche.clamp, style.clamp, colors.clamp].filter((c): c is SeoClamp => !!c);

  return {
    title,
    metaDescription: typeof raw.metaDescription === 'string' ? raw.metaDescription : '',
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === 'string') : [],
    axes: { type: type.value, niche: niche.value, style: style.value, colors: colors.value },
    clamps,
  };
}

function meetsQualityFloor(p: ParsedSeo, minMetaLen: number, minKeywords: number): boolean {
  return p.metaDescription.trim().length >= minMetaLen && p.keywords.length >= minKeywords;
}

/** T2.4: build the one-shot retry prompt when the floor is unmet. Mirrors the
 * repair-prompt pattern in `pipeline/recipes/prompts.ts` (`buildContentRepairPrompt`):
 * restate the original ask, name exactly what was missing, show the previous
 * response, and ask for a corrected reply — never a bare "try again". */
function buildFloorRetryPrompt(basePrompt: string, parsed: ParsedSeo, minMetaLen: number, minKeywords: number): string {
  const missing: string[] = [];
  if (parsed.metaDescription.trim().length < minMetaLen) {
    missing.push(
      `metaDescription must be at least ${minMetaLen} characters (got ${parsed.metaDescription.trim().length}) — write a real, specific summary, not a stub.`,
    );
  }
  if (parsed.keywords.length < minKeywords) {
    missing.push(`keywords must include at least ${minKeywords} relevant, specific keywords (got ${parsed.keywords.length}).`);
  }
  return [
    basePrompt,
    '',
    'Your previous response did not meet the required quality bar:',
    missing.map((m) => `- ${m}`).join('\n'),
    '',
    'Previous response:',
    JSON.stringify({ title: parsed.title, metaDescription: parsed.metaDescription, keywords: parsed.keywords }),
    '',
    'Respond again with ONLY a corrected JSON object meeting every requirement above.',
  ].join('\n');
}

export async function generateSeo(
  json: string,
  target: Target,
  deps: { llm: LlmClient; maxBudgetUsd?: number; log?: (msg: string) => void },
): Promise<GenerateSeoResult> {
  const log = deps.log ?? (() => {});
  const minMetaLen = seoMinMetaDescriptionLength();
  const minKeywords = seoMinKeywords();
  const label = `${target.type}/${target.niche}/${target.style}`;

  const basePrompt = buildSeoPrompt(json, target);
  const attempt = async (prompt: string): Promise<ParsedSeo> => {
    const text = await deps.llm.complete({ prompt, system: SYSTEM, maxBudgetUsd: deps.maxBudgetUsd });
    return parseSeoResponse(text, target);
  };

  let parsed = await attempt(basePrompt);
  let retried = false;

  if (!meetsQualityFloor(parsed, minMetaLen, minKeywords)) {
    retried = true;
    const retryPrompt = buildFloorRetryPrompt(basePrompt, parsed, minMetaLen, minKeywords);
    parsed = await attempt(retryPrompt);
  }

  const floorMissed = !meetsQualityFloor(parsed, minMetaLen, minKeywords);
  if (floorMissed) {
    log(
      `[seo] quality floor still unmet after retry for ${label}: ` +
        `metaDescription length=${parsed.metaDescription.trim().length} (min ${minMetaLen}), ` +
        `keywords=${parsed.keywords.length} (min ${minKeywords})`,
    );
  }

  for (const c of parsed.clamps) {
    log(`[seo] clamp axis=${c.axis} for ${label}: proposed=${JSON.stringify(c.proposed)} -> clamped=${JSON.stringify(c.clamped)}`);
  }

  return {
    title: parsed.title,
    slug: slugify(parsed.title),
    metaDescription: parsed.metaDescription,
    keywords: parsed.keywords,
    axes: parsed.axes,
    seoFloorMissed: floorMissed,
    seoRetried: retried,
    seoClamps: parsed.clamps,
  };
}
