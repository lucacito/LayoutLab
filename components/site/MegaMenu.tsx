'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { Icon } from '@/components/ui/Icon';

const TYPE_ICON: Record<string, string> = {
  hero: 'web',
  pricing: 'sell',
  testimonials: 'format_quote',
  cta: 'ads_click',
  features: 'grid_view',
  faq: 'quiz',
  footer: 'border_bottom',
  header: 'border_top',
  contact: 'mail',
  gallery: 'photo_library',
  blog: 'article',
  full_landing: 'web_asset',
};

type MenuDef = { key: string; label: string; axis: 'type' | 'niche' | 'style'; prefix: string; blurb: string };

const MENUS: MenuDef[] = [
  { key: 'type', label: 'Layouts', axis: 'type', prefix: '/type', blurb: 'Browse by section type' },
  { key: 'niche', label: 'Industries', axis: 'niche', prefix: '/niche', blurb: 'Browse by industry' },
  { key: 'style', label: 'Styles', axis: 'style', prefix: '/style', blurb: 'Browse by aesthetic' },
];

function Panel({ menu }: { menu: MenuDef }) {
  const values = AXIS_VALUES[menu.axis];
  return (
    <div className="absolute left-0 top-full z-50 pt-3">
      <div className="w-[min(720px,90vw)] rounded-card border border-fog bg-paper p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-small font-semibold uppercase tracking-wide text-muted">{menu.blurb}</span>
          <Link href="/browse" className="inline-flex items-center gap-1 text-small font-semibold text-action hover:underline">
            View all <Icon name="arrow_forward" size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {values.map((v) => (
            <Link
              key={v}
              href={`${menu.prefix}/${v}`}
              className="group flex items-center gap-2.5 rounded-button px-3 py-2 text-body text-navy transition hover:bg-mist"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-mist text-muted transition group-hover:bg-action group-hover:text-paper">
                <Icon name={menu.axis === 'type' ? (TYPE_ICON[v] ?? 'crop_square') : menu.axis === 'niche' ? 'storefront' : 'palette'} size={18} />
              </span>
              <span className="truncate font-medium">{axisLabel(v)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MegaMenu() {
  const [open, setOpen] = useState<string | null>(null);
  const active = MENUS.find((m) => m.key === open);
  return (
    <nav className="relative hidden items-center gap-1 md:flex" onMouseLeave={() => setOpen(null)}>
      {MENUS.map((m) => (
        <button
          key={m.key}
          type="button"
          onMouseEnter={() => setOpen(m.key)}
          onFocus={() => setOpen(m.key)}
          onClick={() => setOpen(open === m.key ? null : m.key)}
          aria-expanded={open === m.key}
          className="flex items-center gap-0.5 rounded-button px-3 py-2 text-body font-medium text-navy transition hover:text-action"
        >
          {m.label}
          <Icon name="expand_more" size={18} className={`transition-transform ${open === m.key ? 'rotate-180 text-action' : 'text-muted'}`} />
        </button>
      ))}
      <Link href="/pricing" className="rounded-button px-3 py-2 text-body font-medium text-navy transition hover:text-action">
        Pricing
      </Link>
      {active && <Panel menu={active} />}
    </nav>
  );
}
