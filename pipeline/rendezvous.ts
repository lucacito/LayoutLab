// Deterministic string hash (FNV-1a), NOT randomness — same input string always
// hashes to the same number, so re-running the pipeline (idempotent/resumable,
// see buildVariants in recipes/matrix.ts) always assigns the same pick to the
// same key. No Date.now/Math.random anywhere in this module.
//
// Extracted from pipeline/compose/palettes.ts (Phase 1, rich-generator spec) so
// modules in pipeline/recipes/ can use rendezvous selection without importing
// compose/ (which would cycle: palettes -> brief -> @/pipeline/recipes).
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Rendezvous (Highest Random Weight) hashing: deterministically pick ONE item from
 *  `items` for a given `key`, scoring each item by `hash(key + ':' + item.id)` and
 *  taking the max. This is the append-stable alternative to `hash(key) % items.length`:
 *  with modulo indexing, adding or removing a single bucket entry reshuffles almost
 *  every key's assignment (the divisor changes), silently breaking resumability —
 *  a previously-generated (style, niche) landing would get a different palette on
 *  the next pipeline run for a target that already has content. With rendezvous
 *  hashing, appending a new item only steals the keys for which that new item now
 *  scores highest; every key that keeps losing to its original winner is untouched
 *  (see the append-stability test in tests/compose-palettes.test.ts). Never derive
 *  `item.id` from array position — it must be a stable, hand-assigned string. */
export function pickByRendezvous<T extends { id: string }>(key: string, items: readonly T[]): T {
  let best = items[0];
  let bestScore = -1;
  for (const item of items) {
    const score = hashString(`${key}:${item.id}`);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
