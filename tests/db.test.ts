// tests/db.test.ts
import { describe, it, expect } from 'vitest';
import {
  layouts, packs, packLayouts, tags, layoutTags,
  users, orders, orderItems, subscriptions, entitlements,
  downloads, emailCaptures,
} from '@/db/schema';

describe('db schema (Phase 1 full model)', () => {
  it('exposes the layouts table with facet columns', () => {
    expect((layouts as any).slug).toBeDefined();
    expect((layouts as any).type).toBeDefined();
    expect((layouts as any).niche).toBeDefined();
    expect((layouts as any).style).toBeDefined();
    expect((layouts as any).colors).toBeDefined();
    expect((layouts as any).status).toBeDefined();
  });

  it('exposes packs + the pack_layouts join', () => {
    expect((packs as any).slug).toBeDefined();
    expect((packs as any).kind).toBeDefined();
    expect((packLayouts as any).packId).toBeDefined();
    expect((packLayouts as any).layoutId).toBeDefined();
  });

  it('exposes a single tags table with an axis discriminator', () => {
    expect((tags as any).axis).toBeDefined();
    expect((tags as any).slug).toBeDefined();
    expect((layoutTags as any).tagId).toBeDefined();
  });

  it('exposes commerce + account tables (unused in Phase 1)', () => {
    for (const t of [users, orders, orderItems, subscriptions, entitlements, downloads, emailCaptures]) {
      expect(t).toBeDefined();
    }
  });
});
