import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { AXIS_META, TYPE_LABELS } from '@/lib/nav/menu-data';
import { AXIS_VALUES } from '@/lib/catalog/filters';

type Counts = Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>;

function typeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// "Find layouts by type" — a tile grid of every section type. Industries have their own
// dedicated section below, so this axis stands alone here (distinct visual treatment: flat
// tiles, not preview cards) and reads as a clean "what kind of section do you need?" index.
export function ElementDirectory({ counts }: { counts: Counts }) {
  return (
    <section className="border-y border-border bg-mist py-12">
      <Container>
        <SectionTitle eyebrow="By section" title="Find layouts by type">
          Pick the kind of section you need — hero, pricing, FAQ, CTA and more.
        </SectionTitle>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AXIS_VALUES.type.map((v) => {
            const meta = AXIS_META.type[v];
            const count = counts.type?.[v] ?? 0;
            return (
              <Link
                key={v}
                href={`/type/${v}`}
                className="group flex items-center gap-3 rounded-card border border-border bg-paper px-4 py-3 transition hover:-translate-y-0.5 hover:border-action"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action/10 text-action">
                  <Icon name={meta?.icon ?? 'category'} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-navy group-hover:text-action">
                    {typeLabel(v)}
                  </span>
                  <span className="block truncate text-small text-muted">{meta?.blurb}</span>
                </span>
                {count > 0 && <span className="shrink-0 text-small tabular-nums text-muted">{count}</span>}
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
