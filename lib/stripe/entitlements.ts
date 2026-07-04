export interface UserEntitlement {
  scope: string; // 'all_access' | `pack:${id}`
  source: string; // 'order' | 'subscription' | 'free'
  expiresAt: Date | null;
}

export function isActiveAllAccess(e: UserEntitlement, now: Date): boolean {
  if (e.scope !== 'all_access') return false;
  return e.expiresAt == null || e.expiresAt.getTime() > now.getTime();
}

export interface CanDownloadInput {
  layoutPackIds: string[];
  packKindById: Record<string, 'free' | 'paid'>;
  userEntitlements: UserEntitlement[];
  freeCapturedPackIds?: string[];
  now?: Date;
}

export function canDownloadLayout(input: CanDownloadInput): boolean {
  const now = input.now ?? new Date();

  // Active all-access subscription unlocks everything.
  if (input.userEntitlements.some((e) => isActiveAllAccess(e, now))) return true;

  const ownedPackScopes = new Set(
    input.userEntitlements.filter((e) => e.scope.startsWith('pack:')).map((e) => e.scope),
  );
  const captured = new Set(input.freeCapturedPackIds ?? []);

  for (const packId of input.layoutPackIds) {
    if (ownedPackScopes.has(`pack:${packId}`)) return true;
    if (input.packKindById[packId] === 'free' && captured.has(packId)) return true;
  }
  return false;
}

/**
 * A layout is "paid-only" when it belongs to at least one pack AND every pack it
 * belongs to is paid. Such layouts are NOT free lead magnets: their JSON download
 * must be gated behind an entitlement (pack ownership or all-access), never handed
 * out for just a captured email. Standalone layouts (no pack) and layouts that
 * belong to any free pack remain free, email-gated lead magnets.
 */
export function isPaidOnlyLayout(input: {
  packIds: string[];
  packKindById: Record<string, 'free' | 'paid'>;
}): boolean {
  if (input.packIds.length === 0) return false;
  return input.packIds.every((id) => input.packKindById[id] === 'paid');
}

/** A pack bundle is downloadable with active all-access OR ownership of pack:<id>. */
export function canDownloadPack(input: { packId: string; userEntitlements: UserEntitlement[]; now?: Date }): boolean {
  const now = input.now ?? new Date();
  if (input.userEntitlements.some((e) => isActiveAllAccess(e, now))) return true;
  return input.userEntitlements.some((e) => e.scope === `pack:${input.packId}`);
}
