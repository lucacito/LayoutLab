import { Container } from '@/components/ui/Container';
import { LayoutCard } from '@/components/LayoutCard';
import { Pagination } from '@/components/Pagination';
import { JsonLd } from '@/components/JsonLd';
import { itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import type { TaxonomyAxis, TaxonomyCopy } from '@/lib/seo/taxonomy';
import type { LayoutRow } from '@/lib/catalog/queries';

export function TaxonomyLanding({ axis, value, siteUrl, copy, layouts, searchParams, currentPage, totalPages }: {
  axis: TaxonomyAxis; value: string; siteUrl: string; copy: TaxonomyCopy; layouts: LayoutRow[];
  searchParams: Record<string, string | string[] | undefined>; currentPage: number; totalPages: number;
}) {
  const label = axisLabel(value);
  const pageUrl = `${siteUrl}/${axis}/${value}`;
  return (
    <main className="py-12">
      <Container>
        <nav className="text-small text-muted">
          <a href={`${siteUrl}/browse`} className="hover:text-action">Browse</a> <span aria-hidden>/</span> <span className="capitalize">{axis}</span> <span aria-hidden>/</span> <span className="text-navy">{label}</span>
        </nav>
        <h1 className="mt-4 text-h2 text-navy">{label} Divi 5 Layouts</h1>
        <p className="mt-3 max-w-2xl text-body text-muted">{copy.intro}</p>

        {layouts.length === 0 ? (
          <p className="mt-10 text-body text-muted">No layouts here yet — check back soon.</p>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
            </div>
            <Pagination
              basePath={`/${axis}/${value}`}
              searchParams={searchParams}
              currentPage={currentPage}
              totalPages={totalPages}
            />
          </>
        )}
      </Container>

      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: siteUrl },
        { name: 'Browse', url: `${siteUrl}/browse` },
        { name: `${label} Layouts`, url: pageUrl },
      ])} />
      <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${siteUrl}/layouts/${l.slug}` })))} />
    </main>
  );
}
