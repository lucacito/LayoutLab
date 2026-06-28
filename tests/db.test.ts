import { describe, it, expect } from 'vitest';
import { layouts } from '@/db/schema';

describe('db schema', () => {
  it('exposes the layouts table with a slug column', () => {
    expect(layouts).toBeDefined();
    // Drizzle pg tables expose columns via the table object.
    expect((layouts as any).slug).toBeDefined();
  });
});
