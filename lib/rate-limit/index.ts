// Best-effort in-memory fixed-window limiter. Per-instance only (resets on cold
// start; not shared across serverless instances) — a stopgap to be replaced by a
// shared store (Vercel KV/Upstash). See CLAUDE.md §16.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { limit: number; windowMs: number; now?: number }): { ok: boolean; remaining: number } {
  const now = opts.now ?? Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1 };
  }
  if (b.count >= opts.limit) return { ok: false, remaining: 0 };
  b.count += 1;
  return { ok: true, remaining: opts.limit - b.count };
}

/** Test-only: clear all buckets. */
export function __resetRateLimit(): void { buckets.clear(); }
