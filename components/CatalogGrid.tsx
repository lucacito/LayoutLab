// components/CatalogGrid.tsx
import { LayoutCard } from '@/components/LayoutCard';
import { PackCard } from '@/components/PackCard';
import type { CatalogItem, LayoutRow, PackItem } from '@/lib/catalog/queries';

/**
 * The catalog grid: a paid pack shows once as a pack card (its pages are sold together), then the
 * layouts. Pass `items` (listCatalogItems) to show packs and layouts in one newest-first order;
 * without it, packs come first and then the layouts.
 */
export function CatalogGrid({ packs = [], layouts, items, className = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3' }: {
  packs?: PackItem[]; layouts: LayoutRow[]; items?: CatalogItem[]; className?: string;
}) {
  if (items) {
    return (
      <div className={className}>
        {items.map((i) => i.kind === 'pack'
          ? <PackCard key={`p-${i.pack.id}`} pack={i.pack} pageCount={i.pageCount} />
          : <LayoutCard key={`l-${i.layout.id}`} layout={i.layout} />)}
      </div>
    );
  }
  return (
    <div className={className}>
      {packs.map((p) => <PackCard key={p.pack.id} pack={p.pack} pageCount={p.pageCount} />)}
      {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
    </div>
  );
}
