'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import {
  PRIMARY_NAV,
  PLUGIN_MENU,
  LAYOUT_MENU_COLUMNS,
  LAYOUT_MENU_CTA,
  type MegaKey,
} from '@/lib/nav/menu-data';

const ICONS: Record<string, string> = {
  plugins: 'extension',
  layouts: 'dashboard_customize',
  guides: 'menu_book',
};

// Flattened sub-links per mega-menu, for the mobile accordion.
const SUBLINKS: Record<MegaKey, { href: string; label: string; icon: string }[]> = {
  plugins: [
    ...PLUGIN_MENU.map((p) => ({ href: p.href, label: p.name, icon: p.icon })),
    { href: '/plugins', label: 'All plugins', icon: 'apps' },
  ],
  layouts: [
    ...LAYOUT_MENU_COLUMNS.flatMap((c) => c.links.map((l) => ({ href: l.href, label: l.label, icon: l.icon }))),
    { href: LAYOUT_MENU_CTA.href, label: LAYOUT_MENU_CTA.label, icon: LAYOUT_MENU_CTA.icon },
  ],
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<MegaKey | null>(null);
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  const close = () => {
    setOpen(false);
    setExpanded(null);
  };

  return (
    <div className="md:hidden">
      <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-button p-2 text-navy">
        <Icon name={open ? 'close' : 'menu'} size={26} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-paper px-4 py-4">
          {PRIMARY_NAV.map((m) =>
            m.mega ? (
              <div key={m.key} className="border-t border-fog first:border-t-0">
                <div className="flex items-center">
                  <Link href={m.href} onClick={close} className="flex flex-1 items-center gap-2 px-2 py-3 text-body font-medium text-navy">
                    <Icon name={ICONS[m.key] ?? 'chevron_right'} size={20} className="text-muted" /> {m.label}
                  </Link>
                  <button
                    aria-label={`Toggle ${m.label} submenu`}
                    aria-expanded={expanded === m.mega}
                    onClick={() => setExpanded((v) => (v === m.mega ? null : m.mega!))}
                    className="p-3 text-muted"
                  >
                    <Icon name="expand_more" size={20} className={expanded === m.mega ? 'rotate-180' : ''} />
                  </button>
                </div>
                {expanded === m.mega && (
                  <div className="pb-2">
                    {SUBLINKS[m.mega].map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        onClick={close}
                        className="flex items-center gap-2 rounded-button py-2 pl-9 pr-2 text-small font-medium text-muted hover:text-action"
                      >
                        <Icon name={s.icon} size={17} /> {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link key={m.key} href={m.href} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy first:border-t-0">
                <Icon name={ICONS[m.key] ?? 'chevron_right'} size={20} className="text-muted" /> {m.label}
              </Link>
            ),
          )}

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
