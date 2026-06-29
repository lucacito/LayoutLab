// Client-safe types + helper for FREE/PAID category badges. The DB-backed query
// lives in ./category-access-query (server-only) so this module can be imported
// by client components (e.g. the megamenu) without pulling in `pg`.

export type Access = 'free' | 'paid';
export type CategoryAccess = Record<'type' | 'niche' | 'style', Record<string, Access>>;

/** FREE if the value is in the free set, else PAID. */
export function accessFor(map: Record<string, Access> | undefined, value: string): Access {
  return map?.[value] === 'free' ? 'free' : 'paid';
}
