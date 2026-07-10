import Link from 'next/link';
import { PRIMARY_NAV } from '@/lib/nav/menu-data';

// Desktop funnel navigation — plain links, no dropdowns. The taxonomy mega-menu
// was intentionally removed; taxonomy SEO links live in the footer.
export function PrimaryNav() {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {PRIMARY_NAV.map((m) => (
        <Link
          key={m.key}
          href={m.href}
          className="rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action"
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
