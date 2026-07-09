import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { previewUrls, uploadLayout, uploadScreenshot } from '@/pipeline/upload';

describe('uploadScreenshot', () => {
  const optimized = {
    buffer: Buffer.from('webp-bytes'),
    width: 1600,
    height: 900,
    quality: 74,
    format: 'webp' as const,
  };

  it('optimizes to WebP and uploads under a .webp key with image/webp content-type', async () => {
    const optimize = vi.fn(async () => optimized);
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const url = await uploadScreenshot('h1', 'desktop', Buffer.from('raw-png'), {
      hasBlobToken: true,
      upload,
      optimize,
    });
    expect(optimize).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledWith('layouts/h1-desktop.webp', optimized.buffer, 'image/webp');
    expect(url).toBe('https://blob/layouts/h1-desktop.webp');
  });

  it('writes the optimized WebP locally when no Blob token', async () => {
    const optimize = vi.fn(async () => optimized);
    const writeFile = vi.fn();
    const url = await uploadScreenshot('h2', 'mobile', Buffer.from('raw-png'), {
      hasBlobToken: false,
      publicDir: '/tmp/shots',
      writeFile,
      optimize,
    });
    expect(writeFile).toHaveBeenCalledWith('/tmp/shots/h2-mobile.webp', optimized.buffer);
    expect(url).toBe('/screenshots/h2-mobile.webp');
  });

  it('really converts a PNG buffer to WebP by default (integration)', async () => {
    const png = await sharp({ create: { width: 2000, height: 800, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .png()
      .toBuffer();
    let uploadedBuffer: Buffer | undefined;
    const upload = vi.fn(async (key: string, data: Buffer) => {
      uploadedBuffer = data;
      return { url: `https://blob/${key}` };
    });
    await uploadScreenshot('h3', 'desktop', png, { hasBlobToken: true, upload });
    const meta = await sharp(uploadedBuffer!).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
  });
});

describe('previewUrls', () => {
  it('is deterministic per hash and returns 3 by default', () => {
    const a = previewUrls('abc');
    expect(a).toHaveLength(3);
    expect(previewUrls('abc')).toEqual(a);
    expect(a[0]).toContain('abc');
  });
});

describe('uploadLayout', () => {
  it('uploads JSON to Blob when a token is present', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const r = await uploadLayout('h1', '{"x":1}', { hasBlobToken: true, outDir: '/tmp/out', upload });
    expect(upload).toHaveBeenCalledOnce();
    // Stores the real returned Blob URL, not the key.
    expect(r.diviJsonBlobKey).toBe('https://blob/layouts/h1.json');
    expect(r.previewImageKeys).toHaveLength(3);
  });

  it('writes JSON locally when no token', async () => {
    const writeFile = vi.fn();
    const r = await uploadLayout('h2', '{"x":1}', { hasBlobToken: false, outDir: '/tmp/out', writeFile });
    expect(writeFile).toHaveBeenCalledWith('/tmp/out/h2.json', '{"x":1}');
    expect(r.diviJsonBlobKey).toBe('/tmp/out/h2.json');
  });
});
