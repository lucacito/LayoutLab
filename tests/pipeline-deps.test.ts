// tests/pipeline-deps.test.ts — T1.3 review fix: partial-render temp-file
// cleanup. `captureScreenshots` (pipeline/deps.ts) uploads each rendered shot
// to Blob AND writes it to a local temp file for the vision critic to Read. If
// an exception occurs mid-loop (e.g. uploadScreenshot throws for the mobile
// shot after the desktop PNG was already written), the already-written temp
// dir must be cleaned up before the error propagates — the previous inline
// version silently returned `{ previewImageKeys: [] }` on failure without ever
// removing what had already been written to disk.
import { describe, it, expect, vi } from 'vitest';
import { captureScreenshots, renderAndCapture } from '@/pipeline/deps';
import type { RenderDeps, RenderResult } from '@/pipeline/render';

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

// T2.1: `renderAndCapture` is the extracted, independently-testable version of
// `buildRunDeps`'s `render` closure — it must preserve THREE distinct outcomes
// for run.ts to gate on: ok (real previews), blank (renderLayout's explicit
// verdict — no captureScreenshots call, no fake previews), and failed
// (renderLayout OR captureScreenshots throws — converted to a resolved
// `{ previewImageKeys: [], error }` so run.ts never has to catch an exception
// from a production-wired renderer, matching T1.3's existing swallow-and-log
// convention, but now carrying the message for the render_failed RunEvent's
// `detail` field).
describe('renderAndCapture (T2.1 — deps.ts render-closure outcome split)', () => {
  const fakeRenderDeps = {} as RenderDeps; // renderLayout is stubbed below; never actually touches this
  const noopCapture = vi.fn(async () => ({ previewImageKeys: [], screenshotPaths: [] }));

  it('ok outcome: captures screenshots and returns previews + hash, outcome "ok"', async () => {
    const shots = [{ label: 'desktop' as const, width: 1440, buffer: Buffer.from('d') }];
    const renderLayout = vi.fn(async (): Promise<RenderResult> => ({ outcome: 'ok', shots, perceptualHash: 'abc123' }));
    const captureScreenshotsStub = vi.fn(async () => ({ previewImageKeys: ['k1'], screenshotPaths: ['/tmp/d.png'] }));
    const result = await renderAndCapture(
      { title: 'T', postContent: '<p>x</p>', hash: 'hash123' },
      { renderLayout, renderDeps: fakeRenderDeps, captureScreenshots: captureScreenshotsStub, hasBlobToken: false, logPrefix: '[test]' },
    );
    expect(captureScreenshotsStub).toHaveBeenCalledWith(shots, 'hash123', { hasBlobToken: false });
    expect(result).toEqual({
      previewImageKeys: ['k1'],
      perceptualHash: 'abc123',
      screenshotPaths: ['/tmp/d.png'],
      outcome: 'ok',
    });
  });

  it('blank outcome: never calls captureScreenshots and returns no previews, outcome "blank"', async () => {
    const renderLayout = vi.fn(async (): Promise<RenderResult> => ({ outcome: 'blank', shots: [] }));
    const captureScreenshotsStub = vi.fn(noopCapture);
    const result = await renderAndCapture(
      { title: 'T', postContent: '<p>x</p>', hash: 'hash123' },
      { renderLayout, renderDeps: fakeRenderDeps, captureScreenshots: captureScreenshotsStub, hasBlobToken: false, logPrefix: '[test]' },
    );
    expect(captureScreenshotsStub).not.toHaveBeenCalled();
    expect(result).toEqual({ previewImageKeys: [], outcome: 'blank' });
  });

  it('failed outcome: renderLayout throwing is swallowed into a resolved result carrying the error message (not "blank")', async () => {
    const renderLayout = vi.fn(async (): Promise<RenderResult> => {
      throw new Error('wp-cli boom');
    });
    const result = await renderAndCapture(
      { title: 'T', postContent: '<p>x</p>', hash: 'hash123' },
      { renderLayout, renderDeps: fakeRenderDeps, captureScreenshots: noopCapture, hasBlobToken: false, logPrefix: '[test]' },
    );
    expect(result).toEqual({ previewImageKeys: [], error: 'wp-cli boom' });
    expect(result.outcome).toBeUndefined();
  });

  it('failed outcome: captureScreenshots throwing after a healthy render is also swallowed as an error (not "blank")', async () => {
    const shots = [{ label: 'desktop' as const, width: 1440, buffer: Buffer.from('d') }];
    const renderLayout = vi.fn(async (): Promise<RenderResult> => ({ outcome: 'ok', shots, perceptualHash: 'abc123' }));
    const captureScreenshotsStub = vi.fn(async () => {
      throw new Error('blob upload boom');
    });
    const result = await renderAndCapture(
      { title: 'T', postContent: '<p>x</p>', hash: 'hash123' },
      { renderLayout, renderDeps: fakeRenderDeps, captureScreenshots: captureScreenshotsStub, hasBlobToken: false, logPrefix: '[test]' },
    );
    expect(result).toEqual({ previewImageKeys: [], error: 'blob upload boom' });
  });
});
