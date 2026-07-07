import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { LayoutCard } from '@/components/LayoutCard';
import type { LayoutRow } from '@/lib/catalog/queries';

/** One homepage "browse by category" row: header (icon + title + blurb + view-all) over a card grid. */
export function CategorySection({
  label,
  blurb,
  icon,
  href,
  count,
  layouts,
}: {
  label: string;
  blurb: string;
  icon: string;
  href: string;
  count: number;
  layouts: LayoutRow[];
}) {
  return (
    <Container>
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-action/10 text-action">
            <Icon name={icon} size={24} />
          </span>
          <div>
            <h2 className="text-h3 text-navy">{label}</h2>
            <p className="text-small text-muted">{blurb}</p>
          </div>
        </div>
        <Link href={href} className="shrink-0 whitespace-nowrap text-small font-semibold text-action hover:underline">
          View all {count} <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {layouts.map((l) => (
          <LayoutCard key={l.id} layout={l} flat />
        ))}
      </div>
    </Container>
  );
}
