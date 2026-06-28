// components/SearchSort.tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SearchSort() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={(fd) => update('q', String(fd.get('q') ?? ''))} className="flex-1">
        <input name="q" defaultValue={params.get('q') ?? ''} placeholder="Search layouts…"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </form>
      <select value={params.get('sort') ?? 'newest'} onChange={(e) => update('sort', e.target.value)}
        className="rounded border border-gray-300 px-2 py-2 text-sm">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="title">Title A–Z</option>
      </select>
    </div>
  );
}
