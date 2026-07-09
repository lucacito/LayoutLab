import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { LayoutCard } from '@/components/LayoutCard';
import { Pagination } from '@/components/Pagination';
import { JsonLd } from '@/components/JsonLd';
import { Markdown } from '@/components/Markdown';
import { itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { hubLinkGroups } from '@/lib/seo/internal-links';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import type { TaxonomyAxis, TaxonomyCopy } from '@/lib/seo/taxonomy';
import type { LayoutRow } from '@/lib/catalog/queries';

export function TaxonomyLanding({ axis, value, siteUrl, copy, layouts, searchParams, currentPage, totalPages, guides = [] }: {
  axis: TaxonomyAxis; value: string; siteUrl: string; copy: TaxonomyCopy; layouts: LayoutRow[];
  searchParams: Record<string, string | string[] | undefined>; currentPage: number; totalPages: number;
  /** Latest guides for the cross-link block (passed by the page — keeps this component fs-free). */
  guides?: { slug: string; title: string }[];
}) {
  const label = axisLabel(value);
  const pageUrl = `${siteUrl}/${axis}/${value}`;
  // Sibling values on the same axis — the strongest "related categories" links.
  const siblings = AXIS_VALUES[axis].filter((v) => v !== value);
  // Cross-axis hubs, minus the group for the current axis (its links live above as siblings).
  const crossGroups = hubLinkGroups().filter((g) => g.axis !== axis);
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

        {copy.body && (
          <section className="mt-14 max-w-3xl">
            <Markdown content={copy.body} />
          </section>
        )}

        <section className="mt-14">
          <h2 className="text-section text-navy">Related categories</h2>
          <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-small font-semibold uppercase tracking-wide text-muted">More by {axis === 'type' ? 'section type' : axis}</h3>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {siblings.map((v) => (
                  <li key={v}>
                    <Link href={`/${axis}/${v}`} className="text-small text-muted transition hover:text-action">{axisLabel(v)}</Link>
                  </li>
                ))}
              </ul>
            </div>
            {crossGroups.map((g) => (
              <div key={g.heading}>
                <h3 className="text-small font-semibold uppercase tracking-wide text-muted">{g.heading}</h3>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-small text-muted transition hover:text-action">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {guides.length > 0 && (
              <div>
                <h3 className="text-small font-semibold uppercase tracking-wide text-muted">From the guides</h3>
                <ul className="mt-3 space-y-2">
                  {guides.map((g) => (
                    <li key={g.slug}>
                      <Link href={`/guides/${g.slug}`} className="text-small text-muted transition hover:text-action">{g.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
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
