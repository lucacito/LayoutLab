import type { SortKey } from './filters';

/** What the merge needs to know about a pack or a layout: when it was created and what it is called. */
export interface OrderKey { id: string; createdAt: Date; title: string }

export type OrderedRef = { kind: 'pack' | 'layout'; id: string };

/**
 * One list for the catalog grid in which paid packs and free layouts are ordered together by the
 * chosen sort (newest first by default), instead of every pack coming before every layout.
 * Both inputs must already be in the sort's order (the SQL does that); this is a stable merge, a
 * tie goes to the pack so the result never depends on the input sizes.
 */
export function mergeCatalogOrder(packs: OrderKey[], layouts: OrderKey[], sort: SortKey): OrderedRef[] {
  const before = (a: OrderKey, b: OrderKey): boolean => {
    if (sort === 'title') return a.title.localeCompare(b.title) <= 0;
    const d = a.createdAt.getTime() - b.createdAt.getTime();
    return sort === 'oldest' ? d <= 0 : d >= 0;
  };
  const out: OrderedRef[] = [];
  let i = 0;
  let j = 0;
  while (i < packs.length || j < layouts.length) {
    const takePack = j >= layouts.length || (i < packs.length && before(packs[i], layouts[j]));
    if (takePack) out.push({ kind: 'pack', id: packs[i++].id });
    else out.push({ kind: 'layout', id: layouts[j++].id });
  }
  return out;
}
