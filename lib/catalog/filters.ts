export const AXIS_VALUES = {
  type: ['hero', 'pricing', 'testimonials', 'cta', 'features', 'cards', 'faq', 'footer', 'contact', 'gallery', 'blog', 'full_landing'],
  niche: ['saas', 'agency', 'restaurant', 'real_estate', 'fitness', 'coaching', 'ecommerce', 'nonprofit', 'portfolio', 'events'],
  style: ['minimal', 'bold', 'dark', 'corporate', 'playful', 'elegant'],
  color: ['blue', 'green', 'red', 'purple', 'orange', 'monochrome', 'pastel'],
  columns: ['2', '3', '4'],
} as const;

export const PAGE_SIZE = 24;

export type SortKey = 'newest' | 'oldest' | 'title';
const SORTS: SortKey[] = ['newest', 'oldest', 'title'];

export interface CatalogFilters {
  type: string[];
  niche: string[];
  style: string[];
  color: string[];
  columns: string[];
  q?: string;
  sort: SortKey;
  page: number;
}

function readMulti(raw: string | string[] | undefined, allowed: readonly string[]): string[] {
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : raw.split(',');
  const set = new Set(allowed);
  return values.map((v) => v.trim()).filter((v) => set.has(v));
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters {
  const type = readMulti(searchParams.type, AXIS_VALUES.type);
  const niche = readMulti(searchParams.niche, AXIS_VALUES.niche);
  const style = readMulti(searchParams.style, AXIS_VALUES.style);
  const color = readMulti(searchParams.color, AXIS_VALUES.color);
  const columns = readMulti(searchParams.columns, AXIS_VALUES.columns);

  const rawQ = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const q = rawQ?.trim() ? rawQ.trim() : undefined;

  const rawSort = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = (SORTS as string[]).includes(rawSort ?? '') ? (rawSort as SortKey) : 'newest';

  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return { type, niche, style, color, columns, q, sort, page };
}
