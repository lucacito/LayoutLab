import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { listLayouts, facetCounts } from '@/lib/catalog/queries';
import { env } from '@/lib/env';
import { TaxonomyLanding } from '@/components/TaxonomyLanding';
import { getTaxonomyCopy, type TaxonomyAxis } from '@/lib/seo/taxonomy';
import { taxonomyFallbackCopy } from '@/lib/seo/taxonomy-copy';

// AXIS_VALUES uses key 'color' for the 4th axis; the column filter also uses 'color'.
const VALUES: Record<TaxonomyAxis, readonly string[]> = {
  type: AXIS_VALUES.type, niche: AXIS_VALUES.niche, style: AXIS_VALUES.style, color: AXIS_VALUES.color,
};

function emptyFilters() {
  return { type: [], niche: [], style: [], color: [], columns: [], sort: 'newest' as const, page: 1 };
}

async function loadCopy(axis: TaxonomyAxis, value: string) {
  const counts = await facetCounts().catch(() => null);
  const count = counts?.[axis]?.[value] ?? 0;
  const stored = await getTaxonomyCopy(axis, value).catch(() => null);
  return stored ?? taxonomyFallbackCopy(axis, value, count);
}

export function makeTaxonomyPage(axis: TaxonomyAxis) {
  async function resolve(value: string) {
    if (!VALUES[axis].includes(value)) notFound();
    const layouts = await listLayouts({ ...emptyFilters(), [axis]: [value] });
    const copy = await loadCopy(axis, value);
    return { layouts, copy };
  }

  async function generateMetadata({ params }: { params: Promise<{ value: string }> }): Promise<Metadata> {
    const { value } = await params;
    if (!VALUES[axis].includes(value)) return {};
    const copy = await loadCopy(axis, value);
    const url = `${env.NEXT_PUBLIC_SITE_URL}/${axis}/${value}`;
    return { title: copy.metaTitle, description: copy.metaDescription, alternates: { canonical: url } };
  }

  async function Page({ params }: { params: Promise<{ value: string }> }) {
    const { value } = await params;
    const { layouts, copy } = await resolve(value);
    return <TaxonomyLanding axis={axis} value={value} siteUrl={env.NEXT_PUBLIC_SITE_URL} copy={copy} layouts={layouts} />;
  }

  return { generateMetadata, Page };
}
