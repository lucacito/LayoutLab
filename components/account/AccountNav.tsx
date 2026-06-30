'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

const TABS = [
  { href: '/account', label: 'Overview', icon: 'dashboard' },
  { href: '/account/downloads', label: 'Downloads', icon: 'download' },
  { href: '/account/purchases', label: 'Purchases', icon: 'receipt_long' },
  { href: '/account/billing', label: 'Billing', icon: 'credit_card' },
];

// Shared sub-navigation across the account area, so users can move between their
// stuff without hunting for links.
export function AccountNav() {
  const path = usePathname();
  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-small font-medium transition ${
              active ? 'border-action text-action' : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            <Icon name={t.icon} size={18} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
