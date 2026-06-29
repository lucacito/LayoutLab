import Link from 'next/link';
import { LayoutCard } from '@/components/LayoutCard';
import { TYPE_LABELS } from '@/lib/nav/menu-data';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import type { LayoutRow } from '@/lib/catalog/queries';

// Variant navigation: from any element, flip to other versions of the same type —
// pivot by style, or browse sibling elements directly.
export function RelatedElements({
  type,
  currentStyle,
  related,
}: {
  type: string;
  currentStyle: string | null;
  related: LayoutRow[];
}) {
  if (!related.length) return null;
  const label = (TYPE_LABELS[type] ?? type).toLowerCase();

  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-section text-navy">More {label}</h2>
        <Link href={`/type/${type}`} className="shrink-0 whitespace-nowrap text-small font-semibold text-action hover:underline">
          Browse all {label} <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-small text-muted">Try a style:</span>
        {AXIS_VALUES.style
          .filter((s) => s !== currentStyle)
          .map((s) => (
            <Link
              key={s}
              href={`/browse?type=${type}&style=${s}`}
              className="rounded-full bg-mist px-3 py-1 text-small font-medium capitalize text-navy transition hover:bg-fog"
            >
              {s}
            </Link>
          ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((l) => (
          <LayoutCard key={l.id} layout={l} />
        ))}
      </div>
    </section>
  );
}
