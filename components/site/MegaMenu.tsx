'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { Icon } from '@/components/ui/Icon';
import { AXIS_META, NAV_MENUS, isAxisMenu, type NavAxisMenu } from '@/lib/nav/menu-data';

function Panel({ menu }: { menu: NavAxisMenu }) {
  const values = AXIS_VALUES[menu.axis];
  const meta = AXIS_META[menu.axis];
  return (
    <div className="absolute left-0 top-full z-50 pt-3">
      <div className="w-[min(680px,92vw)] rounded-card border border-fog bg-paper p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {menu.blurb}
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-emerald-700">FREE</span>
          </span>
          <Link href="/browse" className="inline-flex items-center gap-1 text-small font-semibold text-action hover:underline">
            View all <Icon name="arrow_forward" size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {values.map((v) => (
            <Link key={v} href={`${menu.prefix}/${v}`} className="group flex items-start gap-3 rounded-button px-2 py-2 transition hover:bg-mist">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-mist text-muted transition group-hover:bg-action group-hover:text-paper">
                <Icon name={meta[v]?.icon ?? 'crop_square'} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-navy">{axisLabel(v)}</span>
                <span className="block truncate text-[12px] text-muted">{meta[v]?.blurb ?? ''}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MegaMenu() {
  const [open, setOpen] = useState<string | null>(null);
  const active = NAV_MENUS.find((m) => m.key === open && isAxisMenu(m));
  return (
    <nav className="relative hidden items-center gap-0.5 md:flex" onMouseLeave={() => setOpen(null)}>
      {NAV_MENUS.map((m) =>
        isAxisMenu(m) ? (
          <button
            key={m.key}
            type="button"
            onMouseEnter={() => setOpen(m.key)}
            onFocus={() => setOpen(m.key)}
            onClick={() => setOpen(open === m.key ? null : m.key)}
            aria-expanded={open === m.key}
            className="flex items-center gap-0.5 rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action"
          >
            {m.label}
            <Icon name="expand_more" size={16} className={`transition-transform ${open === m.key ? 'rotate-180 text-action' : 'text-muted'}`} />
          </button>
        ) : (
          <Link
            key={m.key}
            href={m.href}
            onMouseEnter={() => setOpen(null)}
            className="rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action"
          >
            {m.label}
          </Link>
        ),
      )}
      <Link href="/pricing" className="rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action">
        Pricing
      </Link>
      {active && isAxisMenu(active) && <Panel menu={active} />}
    </nav>
  );
}
