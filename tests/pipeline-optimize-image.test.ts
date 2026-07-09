import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeScreenshot, WEBP_MAX_DIM, isBlobPngUrl, webpKeyForBlobUrl } from '@/pipeline/optimize-image';

describe('isBlobPngUrl', () => {
  it('matches Blob-hosted PNG screenshot URLs only', () => {
    expect(isBlobPngUrl('https://abc123.public.blob.vercel-storage.com/layouts/h-desktop.png')).toBe(true);
    expect(isBlobPngUrl('https://blob.vercel-storage.com/layouts/h-mobile.png')).toBe(true);
    expect(isBlobPngUrl('https://abc123.public.blob.vercel-storage.com/layouts/h-desktop.webp')).toBe(false); // already converted
    expect(isBlobPngUrl('https://picsum.photos/seed/x-0/1200/900')).toBe(false); // seed placeholder
    expect(isBlobPngUrl('/screenshots/demo.png')).toBe(false); // local demo file
    expect(isBlobPngUrl('https://evil.com/layouts/h.png')).toBe(false);
  });
});

describe('webpKeyForBlobUrl', () => {
  it('derives the sibling .webp blob key from a blob PNG URL', () => {
    expect(webpKeyForBlobUrl('https://abc123.public.blob.vercel-storage.com/layouts/h-desktop.png'))
      .toBe('layouts/h-desktop.webp');
  });
});

async function flatPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 240, g: 244, b: 250 } } })
    .png()
    .toBuffer();
}

// RGB noise — the worst case for lossy compression — so size-budget assertions
// exercise the quality ladder instead of trivially passing on a flat fill.
async function noisePng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('optimizeScreenshot', () => {
  it('converts PNG to WebP and resizes down to the 1600px max width', async () => {
    const out = await optimizeScreenshot(await flatPng(3200, 2000));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1000); // aspect preserved
    expect(out.buffer.length).toBeLessThanOrEqual(250 * 1024);
  });

  it('never enlarges a smaller (mobile) screenshot', async () => {
    const out = await optimizeScreenshot(await flatPng(390, 844));
    expect(out.width).toBe(390);
    expect(out.height).toBe(844);
    expect((await sharp(out.buffer).metadata()).format).toBe('webp');
  });

  it('caps height at the WebP dimension limit for very tall mobile full-page shots', async () => {
    const out = await optimizeScreenshot(await flatPng(400, 17000));
    expect(out.height).toBeLessThanOrEqual(WEBP_MAX_DIM);
    // Aspect preserved: width shrinks with the height cap instead of distorting.
    expect(out.width).toBeLessThan(400);
    expect((await sharp(out.buffer).metadata()).format).toBe('webp');
  });

  it('returns the first quality rung that fits the byte budget', async () => {
    const out = await optimizeScreenshot(await flatPng(1600, 1200), { qualities: [80, 50, 20] });
    expect(out.quality).toBe(80); // flat fill fits at the top rung
  });

  it('walks down the quality ladder when the budget is tight, returning the lowest rung if unreachable', async () => {
    const out = await optimizeScreenshot(await noisePng(800, 600), {
      maxBytes: 5 * 1024, // unreachable for noise
      qualities: [80, 50, 20],
    });
    expect(out.quality).toBe(20);
    expect((await sharp(out.buffer).metadata()).format).toBe('webp');
  });
});
