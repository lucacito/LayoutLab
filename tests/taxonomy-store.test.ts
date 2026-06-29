// tests/taxonomy-store.test.ts
import { describe, it, expect } from 'vitest';
import * as store from '@/lib/seo/taxonomy';

describe('taxonomy store exports', () => {
  it('exposes get/upsert', () => {
    expect(typeof store.getTaxonomyCopy).toBe('function');
    expect(typeof store.upsertTaxonomyCopy).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('taxonomy store integration (needs POSTGRES_URL + migration applied)', () => {
  it('upsert then get round-trips and updates on conflict', async () => {
    await store.upsertTaxonomyCopy('style', 'minimal', { intro: 'a', metaTitle: 't', metaDescription: 'd' });
    expect((await store.getTaxonomyCopy('style', 'minimal'))?.intro).toBe('a');
    await store.upsertTaxonomyCopy('style', 'minimal', { intro: 'b', metaTitle: 't2', metaDescription: 'd2' });
    expect((await store.getTaxonomyCopy('style', 'minimal'))?.intro).toBe('b');
    expect(await store.getTaxonomyCopy('style', 'does-not-exist')).toBeNull();
  });
});
