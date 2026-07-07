import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { renderLayout, perceptualHash, type RenderDeps } from '@/pipeline/render';
import { hammingDistance, DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE } from '@/pipeline/dedupe';

const png = (hex: string) =>
  sharp({ create: { width: 24, height: 24, channels: 3, background: hex } }).png().toBuffer();

// dHash compares each pixel to its right neighbor, so it captures local
// STRUCTURE/edges, not absolute color — a solid image is degenerate. Use a black
// square placed in different corners to get genuinely different hashes.
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

// T1.2: dHash stability + distance behavior, exercised against synthetic images
// built from `sharp` primitives so the test stays offline/fast (no real screenshot).
async function baseImage(): Promise<Buffer> {
  const block1 = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#334455' } }).png().toBuffer();
  const block2 = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#889900' } }).png().toBuffer();
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } })
    .composite([{ input: block1, top: 2, left: 2 }, { input: block2, top: 20, left: 4 }])
    .png()
    .toBuffer();
}

// Same composition as baseImage + one tiny localized tweak in a far corner —
// stands in for "reworded copy" on an otherwise visually identical layout.
async function nearVariant(): Promise<Buffer> {
  const block1 = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#334455' } }).png().toBuffer();
  const block2 = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#889900' } }).png().toBuffer();
  const tweak = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } })
    .composite([{ input: block1, top: 2, left: 2 }, { input: block2, top: 20, left: 4 }, { input: tweak, top: 30, left: 30 }])
    .png()
    .toBuffer();
}

// A wholly different composition — stands in for a genuinely different layout.
async function farVariant(): Promise<Buffer> {
  const block = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#000000' } })
    .composite([{ input: block, top: 6, left: 6 }])
    .png()
    .toBuffer();
}

describe('perceptualHash (dHash) stability + distance', () => {
  it('same image -> identical hash (distance 0)', async () => {
    const img = await baseImage();
    const h1 = await perceptualHash(img);
    const h2 = await perceptualHash(img);
    expect(hammingDistance(h1, h2)).toBe(0);
  });

  it('a small localized change (reworded-copy stand-in) -> hamming distance within the default near-dupe threshold', async () => {
    const h1 = await perceptualHash(await baseImage());
    const h2 = await perceptualHash(await nearVariant());
    expect(hammingDistance(h1, h2)).toBeLessThanOrEqual(DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE);
  });

  it('a genuinely different layout -> hamming distance well over the default near-dupe threshold', async () => {
    const h1 = await perceptualHash(await baseImage());
    const h2 = await perceptualHash(await farVariant());
    expect(hammingDistance(h1, h2)).toBeGreaterThan(DEFAULT_PERCEPTUAL_DUPE_MAX_DISTANCE);
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
