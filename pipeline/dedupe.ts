import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonicalize((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function contentHash(json: string): string {
  const canonical = JSON.stringify(canonicalize(JSON.parse(json)));
  return createHash('sha256').update(canonical).digest('hex');
}

// ---- Near-duplicate detection (T1.2) -------------------------------------
//
// `contentHash` above only catches BYTE-IDENTICAL layouts. Two layouts that
// are visually identical but reworded (the `vary` mode case this task exists
// for) hash completely differently and sail past that gate. `render.ts`
// computes a perceptual hash (dHash) of the rendered screenshot; the
// functions below turn that into an actual near-duplicate GATE.

/** Count of differing bits between two same-length hex strings (each hex char
 * is 4 bits). Throws on a length mismatch — callers that may see hashes from
 * an older/different algorithm should guard via `isNearDuplicate`, which skips
 * mismatched lengths instead of throwing. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`hammingDistance: length mismatch (${a.length} vs ${b.length})`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/** Smallest hamming distance from `newHash` to any hash in `existingHashes`, or
 * `undefined` if the pool is empty (or every entry has a mismatched length —
 * see the aHash→dHash migration note in `render.ts`; mismatched lengths are
 * skipped rather than compared, so a format mismatch can only ever miss a
 * near-dupe, never falsely flag one). */
export function nearestDistance(newHash: string, existingHashes: string[]): number | undefined {
  let nearest: number | undefined;
  for (const existing of existingHashes) {
    if (existing.length !== newHash.length) continue;
    const distance = hammingDistance(newHash, existing);
    if (nearest === undefined || distance < nearest) nearest = distance;
  }
  return nearest;
}

/** True if `newHash` is within `threshold` hamming distance of any hash in
 * `existingHashes`. See `nearestDistance` for the skip-on-mismatch behavior. */
export function isNearDuplicate(newHash: string, existingHashes: string[], threshold: number): boolean {
  const nearest = nearestDistance(newHash, existingHashes);
  return nearest !== undefined && nearest <= threshold;
}

export const DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE = 5;

/** Tunable via env `PERCEPTUAL_DUPE_MAX_DISTANCE` (default 5). Falls back to
 * the default on missing/non-numeric/negative values rather than throwing —
 * a misconfigured env var must not crash the pipeline. */
export function perceptualDupeMaxDistance(): number {
  const raw = process.env.PERCEPTUAL_DUPE_MAX_DISTANCE;
  if (raw === undefined) return DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE;
}
