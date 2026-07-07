import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { LayoutCard } from '@/components/LayoutCard';
import type { LayoutRow } from '@/lib/catalog/queries';

// A curated "good places to start" row. Deliberately NOT driven by fabricated download
// counts — the picks are a hand-ordered spread of the most useful section types so a
// first-time visitor lands on something usable fast. Swap for real popularity data once
// downloads accrue.
export function PopularStartingPoints({ layouts }: { layouts: LayoutRow[] }) {
  if (layouts.length === 0) return null;

  return (
    <section className="py-12">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-small font-semibold uppercase tracking-wide text-action">
              <Icon name="local_fire_department" size={16} /> Popular starting points
            </p>
            <h2 className="mt-1 text-h3 text-navy">Great places to begin</h2>
          </div>
          <a href="/browse" className="shrink-0 whitespace-nowrap text-small font-semibold text-action hover:underline">
            Browse all <span aria-hidden>→</span>
          </a>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {layouts.map((l) => (
            <LayoutCard key={l.id} layout={l} flat />
          ))}
        </div>
      </Container>
    </section>
  );
}
