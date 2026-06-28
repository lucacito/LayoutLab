import { describe, it, expect } from 'vitest';
import { captureDeps } from '@/lib/capture/store';

describe('captureDeps', () => {
  it('exposes the full CaptureDeps surface', () => {
    expect(typeof captureDeps.getFreePack).toBe('function');
    expect(typeof captureDeps.recordCapture).toBe('function');
    expect(typeof captureDeps.setCaptureSynced).toBe('function');
    expect(typeof captureDeps.syncContact).toBe('function');
    expect(typeof captureDeps.findOrCreateUserByEmail).toBe('function');
    expect(typeof captureDeps.grantFreeEntitlement).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('captureDeps integration (needs a seeded POSTGRES_URL)', () => {
  it('getFreePack returns null for an unknown id', async () => {
    expect(await captureDeps.getFreePack('does-not-exist')).toBeNull();
  });
});
