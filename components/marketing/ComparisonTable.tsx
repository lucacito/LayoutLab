import { Icon } from '@/components/ui/Icon';

export function ComparisonTable({
  caption,
  columns,
  rows,
  footnote,
  className = '',
}: {
  caption: string;
  columns: string[];
  rows: { label: string; values: (boolean | string)[] }[];
  footnote?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-card border border-border bg-paper shadow-soft ${className}`}>
      <table className="w-full min-w-[480px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-mist">
            <th scope="col" className="px-5 py-3.5 text-small font-semibold uppercase tracking-wide text-muted">Capability</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-5 py-3.5 text-small font-semibold uppercase tracking-wide text-navy">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-b-0">
              <th scope="row" className="px-5 py-3.5 text-body font-normal text-navy">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className="px-5 py-3.5 text-body text-muted">
                  {v === true ? (
                    <>
                      <Icon name="check_circle" size={20} className="text-action" />
                      <span className="sr-only">Included</span>
                    </>
                  ) : v === false ? (
                    <span aria-label="Not included">—</span>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footnote && <p className="border-t border-border bg-mist px-5 py-3 text-small text-muted">{footnote}</p>}
    </div>
  );
}
