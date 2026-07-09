import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AXIS_VALUES, PAGE_SIZE } from '@/lib/catalog/filters';
import { listLayouts, countLayouts, facetCounts } from '@/lib/catalog/queries';
import { env } from '@/lib/env';
import { TaxonomyLanding } from '@/components/TaxonomyLanding';
import { getTaxonomyCopy, type TaxonomyAxis } from '@/lib/seo/taxonomy';
import { taxonomyFallbackCopy } from '@/lib/seo/taxonomy-copy';

// AXIS_VALUES uses key 'color' for the 4th axis; the column filter also uses 'color'.
const VALUES: Record<TaxonomyAxis, readonly string[]> = {
  type: AXIS_VALUES.type, niche: AXIS_VALUES.niche, style: AXIS_VALUES.style, color: AXIS_VALUES.color,
};

function emptyFilters(page = 1) {
  return { type: [], niche: [], style: [], color: [], columns: [], sort: 'newest' as const, page };
}

function readPage(sp: Record<string, string | string[] | undefined> | undefined): number {
  const raw = Array.isArray(sp?.page) ? sp?.page[0] : sp?.page;
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

async function loadCopy(axis: TaxonomyAxis, value: string) {
  const counts = await facetCounts().catch(() => null);
  const count = counts?.[axis]?.[value] ?? 0;
  const stored = await getTaxonomyCopy(axis, value).catch(() => null);
  return stored ?? taxonomyFallbackCopy(axis, value, count);
}

export function makeTaxonomyPage(axis: TaxonomyAxis) {
  async function resolve(value: string, page: number) {
    if (!VALUES[axis].includes(value)) notFound();
    const filters = { ...emptyFilters(page), [axis]: [value] };
    const [layouts, total, copy] = await Promise.all([
      listLayouts(filters),
      countLayouts(filters),
      loadCopy(axis, value),
    ]);
    return { layouts, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), copy };
  }

  async function generateMetadata({ params }: { params: Promise<{ value: string }> }): Promise<Metadata> {
    const { value } = await params;
    if (!VALUES[axis].includes(value)) return {};
    const copy = await loadCopy(axis, value);
    const url = `${env.NEXT_PUBLIC_SITE_URL}/${axis}/${value}`;
    return { title: copy.metaTitle, description: copy.metaDescription, alternates: { canonical: url } };
  }

  async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ value: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { value } = await params;
    const sp = (await searchParams) ?? {};
    const page = readPage(sp);
    const { layouts, totalPages, copy } = await resolve(value, page);
    return (
      <TaxonomyLanding
        axis={axis}
        value={value}
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        copy={copy}
        layouts={layouts}
        searchParams={sp}
        currentPage={page}
        totalPages={totalPages}
      />
    );
  }

  return { generateMetadata, Page };
}
