// components/Breadcrumbs.tsx
import Link from 'next/link';

export function Breadcrumbs({
  crumbs,
  tone = 'light',
  className = '',
}: {
  crumbs: { name: string; url: string }[];
  /** `dark` = sitting on the immersive canvas. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <nav aria-label="Breadcrumb" className={`text-small ${dark ? 'text-paper/60' : 'text-muted'} ${className}`}>
      <ol className="flex flex-wrap gap-1">
        {crumbs.map((c, i) => (
          <li key={c.url} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {i < crumbs.length - 1 ? (
              // Explicit colour: the global `a { color: action }` base rule
              // would otherwise render these violet-on-violet.
              <Link href={c.url} className={dark ? 'text-paper/75 hover:text-paper' : 'text-muted hover:text-action'}>{c.name}</Link>
            ) : (
              <span aria-current="page" className={dark ? 'text-paper/90' : 'text-navy'}>{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
