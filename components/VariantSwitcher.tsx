import Link from 'next/link';
import type { LayoutRow } from '@/lib/catalog/queries';

const ICON_LABEL: Record<string, string> = { none: 'No icons', top: 'Icon on top', left: 'Icon on left' };

function Chip({ active, href, children }: { active: boolean; href?: string; children: React.ReactNode }) {
  const base = 'rounded-full px-3 py-1 text-small font-medium transition';
  if (active) return <span className={`${base} bg-navy text-paper`}>{children}</span>;
  if (!href) return <span className={`${base} cursor-not-allowed bg-mist text-muted opacity-50`}>{children}</span>;
  return <Link href={href} className={`${base} bg-mist text-navy hover:bg-fog`}>{children}</Link>;
}

// Cross-link sibling variations: switch column count (keeping icon placement) or
// icon placement (keeping columns) by jumping to the matching sibling element.
export function VariantSwitcher({ current, siblings }: { current: LayoutRow; siblings: LayoutRow[] }) {
  const cur = current.variant;
  if (!cur?.group || siblings.length < 2) return null;

  const columns = [...new Set(siblings.map((s) => s.variant?.columns).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b);
  const icons = ['none', 'top', 'left'].filter((ic) => siblings.some((s) => s.variant?.icons === ic));
  const find = (cols: number | undefined, ic: string | undefined) =>
    siblings.find((s) => s.variant?.columns === cols && s.variant?.icons === ic);

  return (
    <div className="mt-4 rounded-card border border-border bg-paper p-4">
      <p className="text-small font-semibold uppercase tracking-wide text-muted">Variations</p>
      <div className="mt-3 space-y-3">
        {columns.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-small text-muted">Columns</span>
            {columns.map((c) => {
              const sib = find(c, cur.icons);
              return (
                <Chip key={c} active={c === cur.columns} href={sib && c !== cur.columns ? `/layouts/${sib.slug}` : undefined}>
                  {c} columns
                </Chip>
              );
            })}
          </div>
        )}
        {icons.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-small text-muted">Icons</span>
            {icons.map((ic) => {
              const sib = find(cur.columns, ic);
              return (
                <Chip key={ic} active={ic === cur.icons} href={sib && ic !== cur.icons ? `/layouts/${sib.slug}` : undefined}>
                  {ICON_LABEL[ic]}
                </Chip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
