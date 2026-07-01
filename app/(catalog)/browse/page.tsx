// app/(catalog)/browse/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { parseFilters } from '@/lib/catalog/filters';
import { listLayouts, facetCounts } from '@/lib/catalog/queries';
import { FacetFilters } from '@/components/FacetFilters';
import { SearchSort } from '@/components/SearchSort';
import { LayoutCard } from '@/components/LayoutCard';
import { Container } from '@/components/ui/Container';
import { JsonLd } from '@/components/JsonLd';
import { collectionPageJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { hubLinkGroups } from '@/lib/seo/internal-links';
import { env } from '@/lib/env';

const SITE = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Free Divi 5 Layouts & Sections — Download & Import',
  description:
    'Browse and download free, validated Divi 5 layouts and sections — heroes, pricing, CTAs, full landing pages and more. Import the JSON into Divi 5 in seconds. Commercial license included.',
  alternates: { canonical: `${SITE}/browse` },
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [layouts, counts] = await Promise.all([listLayouts(filters), facetCounts()]);
  const groups = hubLinkGroups();

  return (
    <main className="py-12">
      <JsonLd
        data={[
          collectionPageJsonLd({
            name: 'Free Divi 5 Layouts & Sections',
            description: 'Browse and download free, validated Divi 5 layouts and sections.',
            url: `${SITE}/browse`,
          }),
          breadcrumbJsonLd([
            { name: 'Home', url: SITE },
            { name: 'Divi 5 Layouts', url: `${SITE}/browse` },
          ]),
        ]}
      />
      <Container>
        <div className="mb-8 max-w-3xl">
          <h1 className="text-h3 text-navy">Free Divi 5 Layouts &amp; Sections</h1>
          <p className="mt-3 text-body text-muted">
            Browse our growing library of validated, import-ready Divi 5 layouts — heroes, pricing
            tables, CTAs, testimonials and full landing pages. Download the JSON, import into the Divi 5
            builder, and customize. Every layout ships with a commercial license.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <FacetFilters counts={counts} />
          <section>
            <div className="mb-4"><SearchSort /></div>
            {layouts.length === 0 ? (
              <p className="py-16 text-center text-muted">No layouts match these filters.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
              </div>
            )}
          </section>
        </div>

        {/* Browse by category — internal links out to the taxonomy hubs (hub → spoke). */}
        <section className="mt-16 border-t border-border pt-10" aria-label="Browse Divi 5 layouts by category">
          <h2 className="text-h4 text-navy">Browse by category</h2>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.heading}>
                <p className="text-small font-semibold text-navy">{g.heading}</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-small text-muted transition hover:text-action">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
