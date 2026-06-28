import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimit } from '@/lib/rate-limit';

beforeEach(() => __resetRateLimit());

describe('rateLimit', () => {
  it('allows up to `limit` in a window, then blocks', () => {
    const opts = { limit: 3, windowMs: 1000, now: 1000 };
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 2 });
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 1 });
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 0 });
    expect(rateLimit('k', opts)).toEqual({ ok: false, remaining: 0 });
  });

  it('resets after the window elapses', () => {
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1000 }).ok).toBe(true);
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1500 }).ok).toBe(false);
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 2100 }).ok).toBe(true);
  });

  it('tracks keys independently', () => {
    const o = { limit: 1, windowMs: 1000, now: 1000 };
    expect(rateLimit('a', o).ok).toBe(true);
    expect(rateLimit('b', o).ok).toBe(true);
    expect(rateLimit('a', o).ok).toBe(false);
  });
});
