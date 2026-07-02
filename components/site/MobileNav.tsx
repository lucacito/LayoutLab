'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { AXIS_META, NAV_MENUS } from '@/lib/nav/menu-data';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  const close = () => {
    setOpen(false);
    setSection(null);
  };

  return (
    <div className="md:hidden">
      <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-button p-2 text-navy">
        <Icon name={open ? 'close' : 'menu'} size={26} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-paper px-4 py-4">
          <Link href="/browse" onClick={close} className="flex items-center gap-2 rounded-button px-2 py-2.5 text-body font-medium text-navy">
            <Icon name="grid_view" size={20} className="text-muted" /> Browse all
          </Link>

          {NAV_MENUS.map((m) => {
            const isOpen = section === m.key;
            const meta = AXIS_META[m.axis];
            return (
              <div key={m.key} className="border-t border-fog">
                <button
                  type="button"
                  onClick={() => setSection(isOpen ? null : m.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-2 py-3 text-body font-medium text-navy"
                >
                  <span className="flex items-center gap-2">
                    {m.label}
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-emerald-700">FREE</span>
                  </span>
                  <Icon name="expand_more" size={20} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-0.5 pb-2">
                    {AXIS_VALUES[m.axis].map((v) => (
                      <Link key={v} href={`${m.prefix}/${v}`} onClick={close} className="flex items-center gap-2.5 rounded-button px-2 py-2 text-small text-navy">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-mist text-muted">
                          <Icon name={meta[v]?.icon ?? 'crop_square'} size={16} />
                        </span>
                        <span className="truncate">{axisLabel(v)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Link href="/pricing" onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy">
            <Icon name="sell" size={20} className="text-muted" /> Pricing
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin/queue" onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-action">
              <Icon name="shield_person" size={20} className="text-action" /> Admin
            </Link>
          )}
          <Link href={user ? '/account' : '/login'} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy">
            <Icon name={user ? 'account_circle' : 'login'} size={20} className="text-muted" /> {user ? 'Account' : 'Sign in'}
          </Link>
          <div className="mt-3">
            <Button href="/browse" className="w-full" onClick={close}>Browse layouts</Button>
          </div>
        </div>
      )}
    </div>
  );
}
