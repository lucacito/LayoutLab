'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PRIMARY_NAV } from '@/lib/nav/menu-data';

const ICONS: Record<string, string> = {
  plugins: 'extension',
  layouts: 'dashboard_customize',
  browse: 'grid_view',
  guides: 'menu_book',
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-button p-2 text-navy">
        <Icon name={open ? 'close' : 'menu'} size={26} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-paper px-4 py-4">
          {PRIMARY_NAV.map((m) => (
            <Link key={m.key} href={m.href} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy first:border-t-0">
              <Icon name={ICONS[m.key] ?? 'chevron_right'} size={20} className="text-muted" /> {m.label}
            </Link>
          ))}

          {user?.role === 'admin' && (
            <Link href="/admin" onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-action">
              <Icon name="shield_person" size={20} className="text-action" /> Admin
            </Link>
          )}
          <Link href={user ? '/account' : '/login'} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy">
            <Icon name={user ? 'account_circle' : 'login'} size={20} className="text-muted" /> {user ? 'Account' : 'Sign in'}
          </Link>
          <div className="mt-3">
            <Button href="/pricing" className="w-full" onClick={close}>Get Pro</Button>
          </div>
        </div>
      )}
    </div>
  );
}
