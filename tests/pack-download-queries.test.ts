import { describe, it, expect } from 'vitest';
import * as q from '@/lib/account/queries';

describe('pack download queries', () => {
  it('exposes getPackForDownload + getPackLayoutsForDownload', () => {
    expect(typeof q.getPackForDownload).toBe('function');
    expect(typeof q.getPackLayoutsForDownload).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('pack download queries (integration)', () => {
  it('getPackForDownload returns null for an unknown pack', async () => {
    expect(await q.getPackForDownload('nope')).toBeNull();
  });
});
