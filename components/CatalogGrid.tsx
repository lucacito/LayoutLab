// components/CatalogGrid.tsx
import { LayoutCard } from '@/components/LayoutCard';
import { PackCard } from '@/components/PackCard';
import type { LayoutRow, PackItem } from '@/lib/catalog/queries';

/**
 * The catalog grid: a paid pack shows once as a pack card (its pages are sold together), then the
 * layouts. Same order as listCatalogItems, which slices packs first.
 */
export function CatalogGrid({ packs = [], layouts, className = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3' }: {
  packs?: PackItem[]; layouts: LayoutRow[]; className?: string;
}) {
  return (
    <div className={className}>
      {packs.map((p) => <PackCard key={p.pack.id} pack={p.pack} pageCount={p.pageCount} />)}
      {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
    </div>
  );
}
