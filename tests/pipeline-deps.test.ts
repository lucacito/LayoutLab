// tests/pipeline-deps.test.ts — T1.3 review fix: partial-render temp-file
// cleanup. `captureScreenshots` (pipeline/deps.ts) uploads each rendered shot
// to Blob AND writes it to a local temp file for the vision critic to Read. If
// an exception occurs mid-loop (e.g. uploadScreenshot throws for the mobile
// shot after the desktop PNG was already written), the already-written temp
// dir must be cleaned up before the error propagates — the previous inline
// version silently returned `{ previewImageKeys: [] }` on failure without ever
// removing what had already been written to disk.
import { describe, it, expect, vi } from 'vitest';
import { captureScreenshots } from '@/pipeline/deps';

describe('captureScreenshots (T1.3 review fix — partial-render cleanup)', () => {
  it('cleans up the temp shot dir when uploadScreenshot throws mid-loop, after the desktop file was already written', async () => {
    const writtenPaths: string[] = [];
    const removed: { path: string; opts: { recursive?: boolean; force?: boolean } }[] = [];
    const mkdtemp = vi.fn(async () => '/tmp/ll-shot-fixed');
    const writeFile = vi.fn(async (path: string) => {
      writtenPaths.push(path);
    });
    const rm = vi.fn(async (path: string, opts: { recursive?: boolean; force?: boolean }) => {
      removed.push({ path, opts });
    });
    const uploadScreenshot = vi
      .fn()
      .mockResolvedValueOnce('key-desktop')
      .mockRejectedValueOnce(new Error('blob upload boom'));

    const shots = [
      { label: 'desktop', buffer: Buffer.from('d') },
      { label: 'mobile', buffer: Buffer.from('m') },
    ];

    await expect(
      captureScreenshots(shots, 'hash123', { hasBlobToken: true, uploadScreenshot, writeFile, mkdtemp, rm }),
    ).rejects.toThrow('blob upload boom');

    // The desktop shot's local file WAS written before the mobile upload threw.
    expect(writtenPaths).toHaveLength(1);
    // The shot dir must be removed (recursively, forced) despite the partial write.
    expect(removed).toHaveLength(1);
    expect(removed[0].path).toBe('/tmp/ll-shot-fixed');
    expect(removed[0].opts).toMatchObject({ recursive: true, force: true });
  });

  it('returns preview keys + local paths for both shots on success, with no cleanup', async () => {
    const mkdtemp = vi.fn(async () => '/tmp/ll-shot-fixed');
    const writeFile = vi.fn(async () => {});
    const rm = vi.fn(async () => {});
    const uploadScreenshot = vi.fn(async (_hash: string, label: string) => `key-${label}`);
    const shots = [
      { label: 'desktop', buffer: Buffer.from('d') },
      { label: 'mobile', buffer: Buffer.from('m') },
    ];

    const result = await captureScreenshots(shots, 'hash123', {
      hasBlobToken: false,
      uploadScreenshot,
      writeFile,
      mkdtemp,
      rm,
    });

    expect(result.previewImageKeys).toEqual(['key-desktop', 'key-mobile']);
    expect(result.screenshotPaths).toEqual(['/tmp/ll-shot-fixed/desktop.png', '/tmp/ll-shot-fixed/mobile.png']);
    expect(rm).not.toHaveBeenCalled();
  });

  it('propagates a mkdtemp failure with nothing to clean up (no dir was ever created)', async () => {
    const mkdtemp = vi.fn(async () => {
      throw new Error('disk full');
    });
    const rm = vi.fn(async () => {});
    await expect(
      captureScreenshots([{ label: 'desktop', buffer: Buffer.from('d') }], 'hash123', { hasBlobToken: true, mkdtemp, rm }),
    ).rejects.toThrow('disk full');
    expect(rm).not.toHaveBeenCalled();
  });
});
