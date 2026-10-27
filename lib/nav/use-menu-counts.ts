'use client';
import { useEffect, useState } from 'react';
import type { NavAxis, MegaLink } from './menu-data';

export type MenuCounts = Record<NavAxis, Record<string, number>>;

// One fetch per page load, shared by the desktop panel and the mobile accordion. The menu renders without counts until
// it arrives (and if it never does), so the header never waits on it.
let inflight: Promise<MenuCounts | null> | null = null;
function load(): Promise<MenuCounts | null> {
  inflight ??= fetch('/api/menu-counts')
    .then((r) => (r.ok ? (r.json() as Promise<MenuCounts>) : null))
    .catch(() => null);
  return inflight;
}

export function useMenuCounts(): MenuCounts | null {
  const [counts, setCounts] = useState<MenuCounts | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then((c) => { if (alive && c) setCounts(c); });
    return () => { alive = false; };
  }, []);
  return counts;
}

export function countFor(counts: MenuCounts | null, link: Pick<MegaLink, 'facet'>): number | undefined {
  if (!counts || !link.facet) return undefined;
  return counts[link.facet.axis]?.[link.facet.value] ?? 0;
}
