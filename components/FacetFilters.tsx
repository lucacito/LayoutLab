// components/FacetFilters.tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AXIS_VALUES } from '@/lib/catalog/filters';

const AXES: { key: keyof typeof AXIS_VALUES; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'niche', label: 'Industry' },
  { key: 'style', label: 'Style' },
  { key: 'color', label: 'Color' },
];

export function FacetFilters({ counts }: { counts: Record<string, Record<string, number>> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toggle = (axis: string, value: string) => {
    const current = new Set((params.get(axis)?.split(',') ?? []).filter(Boolean));
    if (current.has(value)) current.delete(value); else current.add(value);
    const next = new URLSearchParams(params.toString());
    if (current.size) next.set(axis, [...current].join(',')); else next.delete(axis);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  // Count active filters (axis selections + search query); sort is kept on clear.
  const activeCount =
    AXES.reduce((n, { key }) => n + (params.get(key)?.split(',').filter(Boolean).length ?? 0), 0) +
    (params.get('q')?.trim() ? 1 : 0);

  const clearAll = () => {
    const next = new URLSearchParams();
    const sort = params.get('sort');
    if (sort) next.set('sort', sort);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-navy">Filters</h2>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-small font-medium text-action transition hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>
      {AXES.map(({ key, label }) => {
        const selected = new Set((params.get(key)?.split(',') ?? []).filter(Boolean));
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-body font-semibold text-navy">{label}</legend>
            <ul className="space-y-1">
              {AXIS_VALUES[key].map((value) => (
                <li key={value}>
                  <label className="flex cursor-pointer items-center gap-2 text-body text-navy">
                    <input type="checkbox" checked={selected.has(value)} onChange={() => toggle(key, value)} />
                    <span className="capitalize">{value.replace('_', ' ')}</span>
                    <span className="ml-auto text-small text-muted">{counts[key]?.[value] ?? 0}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </aside>
  );
}
