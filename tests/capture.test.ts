import { describe, it, expect, vi } from 'vitest';
import { captureFreePack, normalizeEmail, CaptureError } from '@/lib/capture/capture';

function deps(over: Partial<any> = {}) {
  return {
    getFreePack: vi.fn(async () => ({ id: 'p1' })),
    recordCapture: vi.fn(async () => 'cap1'),
    setCaptureSynced: vi.fn(async () => {}),
    syncContact: vi.fn(async () => ({ synced: true })),
    findOrCreateUserByEmail: vi.fn(async () => 'u1'),
    grantFreeEntitlement: vi.fn(async () => {}),
    ...over,
  };
}

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});

describe('captureFreePack', () => {
  it('rejects a non-free/unpublished pack (getFreePack null) — no capture, no grant', async () => {
    const d = deps({ getFreePack: vi.fn(async () => null) });
    await expect(captureFreePack({ email: 'a@b.c', packId: 'p1' }, d)).rejects.toBeInstanceOf(CaptureError);
    expect(d.recordCapture).not.toHaveBeenCalled();
    expect(d.grantFreeEntitlement).not.toHaveBeenCalled();
  });

  it('happy path: record → sync → setSynced(true) → user → grant, normalized email', async () => {
    const d = deps();
    const res = await captureFreePack({ email: '  A@B.com ', packId: 'p1' }, d);
    expect(res).toEqual({ ok: true, email: 'a@b.com' });
    expect(d.recordCapture).toHaveBeenCalledWith('a@b.com', 'p1');
    expect(d.syncContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', packId: 'p1' }));
    expect(d.setCaptureSynced).toHaveBeenCalledWith('cap1', true);
    expect(d.findOrCreateUserByEmail).toHaveBeenCalledWith('a@b.com');
    expect(d.grantFreeEntitlement).toHaveBeenCalledWith('u1', 'p1');
  });

  it('Loops down (synced:false): still grants, marks setSynced(false)', async () => {
    const d = deps({ syncContact: vi.fn(async () => ({ synced: false })) });
    const res = await captureFreePack({ email: 'a@b.c', packId: 'p1' }, d);
    expect(res.ok).toBe(true);
    expect(d.setCaptureSynced).toHaveBeenCalledWith('cap1', false);
    expect(d.grantFreeEntitlement).toHaveBeenCalledWith('u1', 'p1');
  });
});
