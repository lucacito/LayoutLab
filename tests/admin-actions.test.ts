// tests/admin-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdmin, setLayoutStatus, setLayoutsStatus, revalidatePath, submitToIndexNow } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ user: { role: 'admin' } })),
  setLayoutStatus: vi.fn(async () => ({ slug: 's' })),
  setLayoutsStatus: vi.fn(async () => [{ slug: 'a' }, { slug: 'b' }]),
  revalidatePath: vi.fn(),
  submitToIndexNow: vi.fn(async () => true),
}));

vi.mock('@/lib/auth/admin', () => ({ requireAdmin }));
vi.mock('@/lib/admin/mutations', () => ({ setLayoutStatus, setLayoutsStatus }));
vi.mock('@/lib/seo/indexnow', () => ({ submitToIndexNow }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { approveLayout, rejectLayout, unpublishLayout, bulkApprove } from '@/lib/admin/actions';

beforeEach(() => {
  requireAdmin.mockClear();
  setLayoutStatus.mockClear();
  setLayoutsStatus.mockClear();
  revalidatePath.mockClear();
  submitToIndexNow.mockClear();
});

describe('admin actions', () => {
  it('approveLayout requires admin then publishes with a publishedAt', async () => {
    await approveLayout('l1');
    expect(requireAdmin).toHaveBeenCalledOnce();
    const [id, status, opts] = setLayoutStatus.mock.calls[0] as any[];
    expect(id).toBe('l1');
    expect(status).toBe('published');
    expect(opts.publishedAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith('/browse');
    // Instant-indexing ping fires for the published layout URL.
    const [siteUrl, urls] = submitToIndexNow.mock.calls[0] as any[];
    expect(siteUrl).toBe('https://divi5lab.com');
    expect(urls).toEqual(['https://divi5lab.com/layouts/s']);
  });

  it('rejectLayout sets rejected', async () => {
    await rejectLayout('l2');
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect((setLayoutStatus.mock.calls[0] as any[])[1]).toBe('rejected');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/queue');
  });

  it('unpublishLayout sets approved (de-listed)', async () => {
    await unpublishLayout('l3');
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect((setLayoutStatus.mock.calls[0] as any[])[1]).toBe('approved');
    expect(revalidatePath).toHaveBeenCalledWith('/browse');
  });

  it('bulkApprove requires admin then publishes many', async () => {
    await bulkApprove(['a', 'b']);
    expect(requireAdmin).toHaveBeenCalledOnce();
    const [ids, status, opts] = setLayoutsStatus.mock.calls[0] as any[];
    expect(ids).toEqual(['a', 'b']);
    expect(status).toBe('published');
    expect(opts?.publishedAt).toBeInstanceOf(Date);
    // Both published layout URLs are pushed to IndexNow.
    const [, urls] = submitToIndexNow.mock.calls[0] as any[];
    expect(urls).toEqual([
      'https://divi5lab.com/layouts/a',
      'https://divi5lab.com/layouts/b',
    ]);
  });

  it('rejectLayout and unpublishLayout do NOT ping IndexNow', async () => {
    await rejectLayout('x');
    await unpublishLayout('y');
    expect(submitToIndexNow).not.toHaveBeenCalled();
  });
});
