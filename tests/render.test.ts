import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { renderLayout, perceptualHash, type RenderDeps } from '@/pipeline/render';

const png = (hex: string) =>
  sharp({ create: { width: 24, height: 24, channels: 3, background: hex } }).png().toBuffer();

// aHash compares each pixel to the image's own mean, so it captures STRUCTURE,
// not absolute color — a solid image is degenerate. Use a black square placed in
// different corners to get genuinely different hashes.
async function patterned(corner: 'tl' | 'br'): Promise<Buffer> {
  const square = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000000' } }).png().toBuffer();
  const offset = corner === 'tl' ? 0 : 14;
  return sharp({ create: { width: 24, height: 24, channels: 3, background: '#ffffff' } })
    .composite([{ input: square, top: offset, left: offset }])
    .png()
    .toBuffer();
}

describe('perceptualHash', () => {
  it('is a 64-char hex, stable for the same image, different for differently-structured images', async () => {
    const tl = await patterned('tl');
    const br = await patterned('br');
    const h1 = await perceptualHash(tl);
    const h2 = await perceptualHash(tl);
    const h3 = await perceptualHash(br);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

function deps(over: Partial<RenderDeps> = {}, shot?: Buffer): RenderDeps {
  return {
    createPage: vi.fn(async () => ({ id: '116', url: 'http://wp/?page_id=116' })),
    deletePage: vi.fn(async () => {}),
    screenshot: vi.fn(async () => shot ?? Buffer.from('')),
    ...over,
  };
}

describe('renderLayout', () => {
  it('creates a page, screenshots desktop + mobile, hashes, and deletes the page', async () => {
    const shot = await png('#123456');
    const d = deps({}, shot);
    const res = await renderLayout({ title: 'T', postContent: '<!-- wp:divi/section -->' }, d);

    expect(d.createPage).toHaveBeenCalledWith({ title: 'T', postContent: '<!-- wp:divi/section -->' });
    expect(d.screenshot).toHaveBeenCalledTimes(2);
    expect(d.screenshot).toHaveBeenCalledWith('http://wp/?page_id=116', { width: 1440, height: 1024 });
    expect(d.screenshot).toHaveBeenCalledWith('http://wp/?page_id=116', { width: 390, height: 844 });
    expect(res.shots.map((s) => s.label)).toEqual(['desktop', 'mobile']);
    expect(res.perceptualHash).toMatch(/^[0-9a-f]{64}$/);
    expect(d.deletePage).toHaveBeenCalledWith('116');
  });

  it('deletes the temp page even when a screenshot throws', async () => {
    const d = deps({ screenshot: vi.fn(async () => { throw new Error('shot failed'); }) });
    await expect(renderLayout({ title: 'T', postContent: 'x' }, d)).rejects.toThrow('shot failed');
    expect(d.deletePage).toHaveBeenCalledWith('116');
  });
});
