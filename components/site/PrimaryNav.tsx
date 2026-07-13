'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import {
  PRIMARY_NAV,
  PLUGIN_MENU,
  LAYOUT_MENU_COLUMNS,
  LAYOUT_MENU_CTA,
  type MegaKey,
} from '@/lib/nav/menu-data';

const CHIP_TONE: Record<'green' | 'amber', string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

// Desktop navigation. "Plugins" and "Free layouts" open mega-menu panels on
// hover/focus; their labels still navigate. Panels stay in the DOM (hidden via
// CSS) so links remain crawlable and testable.
export function PrimaryNav() {
  const [open, setOpen] = useState<MegaKey | null>(null);

  return (
    <nav
      className="relative hidden items-center gap-1 md:flex"
      onMouseLeave={() => setOpen(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(null);
      }}
    >
      {PRIMARY_NAV.map((m) => (
        <div key={m.key} onMouseEnter={() => setOpen(m.mega ?? null)}>
          <Link
            href={m.href}
            aria-haspopup={m.mega ? 'true' : undefined}
            aria-expanded={m.mega ? open === m.mega : undefined}
            onFocus={() => setOpen(m.mega ?? null)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action"
          >
            {m.label}
            {m.mega && (
              <Icon
                name="expand_more"
                size={16}
                className={`text-muted transition-transform ${open === m.mega ? 'rotate-180' : ''}`}
              />
            )}
          </Link>
        </div>
      ))}

      {/* Plugins panel */}
      <MegaPanel visible={open === 'plugins'} width="w-[620px]">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          {PLUGIN_MENU.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              onClick={() => setOpen(null)}
              className="group flex flex-col rounded-card p-4 transition hover:bg-mist"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-button bg-fog text-action">
                <Icon name={p.icon} size={20} />
              </span>
              <span className="mt-3 text-body font-semibold text-navy group-hover:text-action">{p.name}</span>
              <span className="mt-1 flex-1 text-small text-muted">{p.desc}</span>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE[p.tone]}`}>
                {p.chip}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border px-4 pt-3 text-small">
          <Link href="/plugins" onClick={() => setOpen(null)} className="font-semibold text-action hover:underline">
            All plugins
          </Link>
          <Link href="/pricing" onClick={() => setOpen(null)} className="font-medium text-muted hover:text-action">
            Pricing
          </Link>
        </div>
      </MegaPanel>

      {/* Free-layouts panel */}
      <MegaPanel visible={open === 'layouts'} width="w-[720px]">
        <div className="grid grid-cols-3 gap-2">
          {LAYOUT_MENU_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{col.title}</p>
              {col.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(null)}
                  className="group flex items-center gap-2.5 rounded-button px-3 py-2 transition hover:bg-mist"
                >
                  <Icon name={l.icon} size={18} className="text-muted group-hover:text-action" />
                  <span className="text-small font-medium text-navy group-hover:text-action">{l.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <Link
          href={LAYOUT_MENU_CTA.href}
          onClick={() => setOpen(null)}
          className="mt-2 flex items-center justify-between gap-3 rounded-card border-t border-border bg-mist px-4 py-3 transition hover:bg-fog"
        >
          <span>
            <span className="text-body font-semibold text-navy">{LAYOUT_MENU_CTA.label}</span>
            <span className="mt-0.5 block text-small text-muted">{LAYOUT_MENU_CTA.blurb}</span>
          </span>
          <Icon name="arrow_forward" size={18} className="shrink-0 text-action" />
        </Link>
      </MegaPanel>
    </nav>
  );
}

function MegaPanel({ visible, width, children }: { visible: boolean; width: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute left-1/2 top-full z-50 mt-3 -translate-x-1/2 ${width} max-w-[calc(100vw-2rem)] rounded-card border border-border bg-paper p-3 shadow-soft transition ${
        visible ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}
