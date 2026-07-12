import { describe, it, expect, vi, beforeEach } from 'vitest';

const values = vi.fn(async () => {});
const where = vi.fn(async () => {});
const set = vi.fn(() => ({ where }));
const insert = vi.fn(() => ({ values }));
const update = vi.fn(() => ({ set }));
vi.mock('@/db/client', () => ({ db: { insert, update } }));
const syncContact = vi.fn(async () => ({ synced: true }));
vi.mock('@/lib/email/loops', () => ({ syncContact }));

beforeEach(() => { values.mockClear(); set.mockClear(); insert.mockClear(); update.mockClear(); syncContact.mockReset(); syncContact.mockResolvedValue({ synced: true }); });

describe('recordLeadCapture', () => {
  it('records a normalized capture, syncs to Loops, and marks synced', async () => {
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await recordLeadCapture('  Buyer@Example.COM ');
    expect(insert).toHaveBeenCalled();
    const row = (values.mock.calls as any[])[0]?.[0] as any;
    expect(row).toBeDefined();
    expect(row.email).toBe('buyer@example.com');
    expect(row.packId ?? null).toBeNull();
    expect(syncContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'buyer@example.com', source: 'free_download' }));
    expect(update).toHaveBeenCalled();
  });
  it('still resolves when Loops fails (best-effort)', async () => {
    syncContact.mockResolvedValue({ synced: false });
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await expect(recordLeadCapture('a@b.com')).resolves.toBeUndefined();
  });
  it('forwards a custom source to loops sync', async () => {
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await recordLeadCapture('x@y.com', 'ai_editor_waitlist');
    expect(syncContact).toHaveBeenCalledWith(expect.objectContaining({ source: 'ai_editor_waitlist' }));
  });
  it('defaults source to free_download', async () => {
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await recordLeadCapture('x@y.com');
    expect(syncContact).toHaveBeenCalledWith(expect.objectContaining({ source: 'free_download' }));
  });
});
