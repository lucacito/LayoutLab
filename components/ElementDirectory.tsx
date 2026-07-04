import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { AXIS_META, NAV_MENUS, isAxisMenu, TYPE_LABELS, NICHE_LABELS } from '@/lib/nav/menu-data';
import { AXIS_VALUES } from '@/lib/catalog/filters';

type Counts = Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>;

const LABELS: Record<string, Record<string, string>> = { type: TYPE_LABELS, niche: NICHE_LABELS };
function labelFor(axis: string, value: string): string {
  return LABELS[axis]?.[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// Compact, exhaustive directory of everything on offer — mirrors the megamenu
// (Layouts / Industries / Styles) so the catalog reads as deep and full of choice,
// with no large preview images. Each value links to its taxonomy landing page.
export function ElementDirectory({ counts }: { counts: Counts }) {
  return (
    <section className="border-y border-border bg-mist py-16">
      <Container>
        <SectionTitle eyebrow="Everything inside" title="Every kind of element">
          A section for every part of your site — pick a starting point and go.
        </SectionTitle>

        <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
          {NAV_MENUS.filter(isAxisMenu).map((menu) => {
            const axis = menu.axis;
            const values = AXIS_VALUES[axis];
            return (
              <div key={menu.key}>
                <div className="flex items-baseline justify-between border-b border-border pb-2">
                  <h3 className="text-small font-semibold uppercase tracking-wide text-muted">{menu.label}</h3>
                  <Link href={menu.prefix === '/type' ? '/browse' : menu.prefix} className="text-small font-medium text-action hover:underline">
                    All
                  </Link>
                </div>
                <ul className="mt-2">
                  {values.map((v) => {
                    const meta = AXIS_META[axis][v];
                    const count = counts[axis]?.[v] ?? 0;
                    return (
                      <li key={v}>
                        <Link
                          href={`${menu.prefix}/${v}`}
                          className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-paper"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-action/10 text-action">
                            <Icon name={meta?.icon ?? 'category'} size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-navy group-hover:text-action">
                              {labelFor(axis, v)}
                            </span>
                            <span className="block truncate text-small text-muted">{meta?.blurb}</span>
                          </span>
                          {count > 0 && <span className="shrink-0 text-small tabular-nums text-muted">{count}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
