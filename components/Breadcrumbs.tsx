// components/Breadcrumbs.tsx
import Link from 'next/link';

export function Breadcrumbs({ crumbs }: { crumbs: { name: string; url: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap gap-1">
        {crumbs.map((c, i) => (
          <li key={c.url} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {i < crumbs.length - 1
              ? <Link href={c.url} className="hover:underline">{c.name}</Link>
              : <span aria-current="page" className="text-gray-700">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
