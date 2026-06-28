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

  return (
    <aside className="space-y-6">
      {AXES.map(({ key, label }) => {
        const selected = new Set((params.get(key)?.split(',') ?? []).filter(Boolean));
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-sm font-semibold text-gray-900">{label}</legend>
            <ul className="space-y-1">
              {AXIS_VALUES[key].map((value) => (
                <li key={value}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selected.has(value)} onChange={() => toggle(key, value)} />
                    <span className="capitalize">{value.replace('_', ' ')}</span>
                    <span className="ml-auto text-xs text-gray-400">{counts[key]?.[value] ?? 0}</span>
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
