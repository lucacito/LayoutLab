'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import { Icon } from '@/components/ui/Icon';
import { accessFor, type Access, type CategoryAccess } from '@/lib/catalog/category-access';

type Axis = 'type' | 'niche' | 'style';

// icon + one-line blurb per taxonomy value.
const META: Record<Axis, Record<string, { icon: string; blurb: string }>> = {
  type: {
    hero: { icon: 'web', blurb: 'Above-the-fold openers' },
    pricing: { icon: 'sell', blurb: 'Plans & price tables' },
    testimonials: { icon: 'format_quote', blurb: 'Social proof & reviews' },
    cta: { icon: 'ads_click', blurb: 'Conversion call-to-actions' },
    features: { icon: 'grid_view', blurb: 'Benefit & feature grids' },
    faq: { icon: 'quiz', blurb: 'Question & answer blocks' },
    footer: { icon: 'border_bottom', blurb: 'Site footers' },
    header: { icon: 'border_top', blurb: 'Navigation headers' },
    contact: { icon: 'mail', blurb: 'Contact & lead forms' },
    gallery: { icon: 'photo_library', blurb: 'Image galleries' },
    blog: { icon: 'article', blurb: 'Article & blog layouts' },
    full_landing: { icon: 'web_asset', blurb: 'Complete landing pages' },
  },
  niche: {
    saas: { icon: 'cloud', blurb: 'Software & apps' },
    agency: { icon: 'campaign', blurb: 'Studios & agencies' },
    restaurant: { icon: 'restaurant', blurb: 'Food & dining' },
    real_estate: { icon: 'home_work', blurb: 'Property & realty' },
    fitness: { icon: 'fitness_center', blurb: 'Gyms & wellness' },
    coaching: { icon: 'school', blurb: 'Coaches & courses' },
    ecommerce: { icon: 'shopping_cart', blurb: 'Online stores' },
    nonprofit: { icon: 'volunteer_activism', blurb: 'Causes & charities' },
    portfolio: { icon: 'palette', blurb: 'Personal & creative' },
    events: { icon: 'event', blurb: 'Events & conferences' },
  },
  style: {
    minimal: { icon: 'air', blurb: 'Clean & spacious' },
    bold: { icon: 'bolt', blurb: 'High-impact & loud' },
    dark: { icon: 'dark_mode', blurb: 'Dark-themed' },
    corporate: { icon: 'apartment', blurb: 'Professional & formal' },
    playful: { icon: 'celebration', blurb: 'Fun & friendly' },
    elegant: { icon: 'diamond', blurb: 'Refined & premium' },
  },
};

type MenuDef = { key: string; label: string; axis: Axis; prefix: string; blurb: string };
const MENUS: MenuDef[] = [
  { key: 'type', label: 'Layouts', axis: 'type', prefix: '/type', blurb: 'Browse by section type' },
  { key: 'niche', label: 'Industries', axis: 'niche', prefix: '/niche', blurb: 'Browse by industry' },
  { key: 'style', label: 'Styles', axis: 'style', prefix: '/style', blurb: 'Browse by aesthetic' },
];

function AccessBadge({ access }: { access: Access }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${
        access === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-fog text-muted'
      }`}
    >
      {access}
    </span>
  );
}

function Panel({ menu, access }: { menu: MenuDef; access: CategoryAccess }) {
  const values = AXIS_VALUES[menu.axis];
  const meta = META[menu.axis];
  const accessMap = access[menu.axis];
  return (
    <div className="absolute left-0 top-full z-50 pt-3">
      <div className="w-[min(680px,92vw)] rounded-card border border-fog bg-paper p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{menu.blurb}</span>
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
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-small font-semibold text-navy">{axisLabel(v)}</span>
                  <AccessBadge access={accessFor(accessMap, v)} />
                </span>
                <span className="block truncate text-[12px] text-muted">{meta[v]?.blurb ?? ''}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MegaMenu({ access }: { access: CategoryAccess }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = MENUS.find((m) => m.key === open);
  return (
    <nav className="relative hidden items-center gap-0.5 md:flex" onMouseLeave={() => setOpen(null)}>
      {MENUS.map((m) => (
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
      ))}
      <Link href="/pricing" className="rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action">
        Pricing
      </Link>
      {active && <Panel menu={active} access={access} />}
    </nav>
  );
}
