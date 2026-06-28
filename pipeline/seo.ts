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

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampOne(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function clampMany(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && allowed.includes(v));
}

const SYSTEM =
  'You write SEO metadata for a Divi 5 layout. Respond with ONLY a JSON object: ' +
  '{ "title", "metaDescription", "keywords": string[], "axes": { "type","niche","style","colors": string[] } }.';

export async function generateSeo(
  json: string,
  target: Target,
  deps: { llm: LlmClient; maxBudgetUsd?: number },
): Promise<LayoutSeo> {
  const prompt = [
    `Write SEO metadata for this Divi 5 ${target.type} layout (niche: ${target.niche}, style: ${target.style}).`,
    `Allowed axis values — type: ${AXIS_VALUES.type.join(', ')}; niche: ${AXIS_VALUES.niche.join(', ')}; style: ${AXIS_VALUES.style.join(', ')}; colors: ${AXIS_VALUES.color.join(', ')}.`,
    'Layout JSON:',
    json,
  ].join('\n');

  const text = await deps.llm.complete({ prompt, system: SYSTEM, maxBudgetUsd: deps.maxBudgetUsd });
  const raw = extractJson(text) as Record<string, unknown>;
  const axes = (raw.axes ?? {}) as Record<string, unknown>;

  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `${target.style} ${target.niche} ${target.type}`;
  return {
    title,
    slug: slugify(title),
    metaDescription: typeof raw.metaDescription === 'string' ? raw.metaDescription : '',
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === 'string') : [],
    axes: {
      type: clampOne(axes.type, AXIS_VALUES.type, target.type),
      niche: clampOne(axes.niche, AXIS_VALUES.niche, target.niche),
      style: clampOne(axes.style, AXIS_VALUES.style, target.style),
      colors: clampMany(axes.colors, AXIS_VALUES.color),
    },
  };
}
