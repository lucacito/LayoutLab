// components/Pagination.tsx
import Link from 'next/link';

/** Build an href for `page`, preserving every other active filter/search/sort param. */
function pageHref(basePath: string, sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === 'page' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Compact page window: first, last, current ±1, with gaps as `null`. */
function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

const linkCls =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-small font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2';

export function Pagination({
  basePath,
  searchParams,
  currentPage,
  totalPages,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const window = pageWindow(currentPage, totalPages);

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link href={pageHref(basePath, searchParams, currentPage - 1)} rel="prev"
          className={`${linkCls} bg-paper text-navy border border-border hover:bg-fog`}>
          ← Prev
        </Link>
      ) : (
        <span className={`${linkCls} border border-border text-muted opacity-40`} aria-disabled>← Prev</span>
      )}

      {window.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>…</span>
        ) : p === currentPage ? (
          <span key={p} aria-current="page" className={`${linkCls} bg-action text-paper`}>{p}</span>
        ) : (
          <Link key={p} href={pageHref(basePath, searchParams, p)}
            className={`${linkCls} bg-paper text-navy border border-border hover:bg-fog`}>
            {p}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link href={pageHref(basePath, searchParams, currentPage + 1)} rel="next"
          className={`${linkCls} bg-paper text-navy border border-border hover:bg-fog`}>
          Next →
        </Link>
      ) : (
        <span className={`${linkCls} border border-border text-muted opacity-40`} aria-disabled>Next →</span>
      )}
    </nav>
  );
}
