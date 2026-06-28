// app/(catalog)/browse/page.tsx
import type { Metadata } from 'next';
import { parseFilters } from '@/lib/catalog/filters';
import { listLayouts, facetCounts } from '@/lib/catalog/queries';
import { FacetFilters } from '@/components/FacetFilters';
import { SearchSort } from '@/components/SearchSort';
import { LayoutCard } from '@/components/LayoutCard';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Browse Divi 5 Layouts',
  description: 'Browse and filter validated Divi 5 layouts by type, industry, style and color.',
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [layouts, counts] = await Promise.all([listLayouts(filters), facetCounts()]);

  return (
    <main className="py-12">
      <Container>
        <h1 className="mb-6 text-h3 text-navy">Browse layouts</h1>
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
      </Container>
    </main>
  );
}
