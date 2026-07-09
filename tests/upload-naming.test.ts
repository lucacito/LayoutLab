import { describe, expect, it, vi } from 'vitest';
import { uploadScreenshot } from '@/pipeline/upload';

const HASH = 'a1b2c3d4e5f6a7b8deadbeef';

describe('uploadScreenshot SEO naming', () => {
  it('uses a descriptive key when seoName is provided (hash8 keeps idempotency)', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const url = await uploadScreenshot(HASH, 'desktop', Buffer.from('x'), {
      hasBlobToken: true,
      upload,
      optimize: async (b) => ({ buffer: b, quality: 80, width: 1600 } as never),
      seoName: 'bold-saas-hero-divi-5-layout',
    });
    expect(upload).toHaveBeenCalledWith('layouts/bold-saas-hero-divi-5-layout-a1b2c3d4-desktop.webp', expect.anything(), 'image/webp');
    expect(url).toContain('bold-saas-hero-divi-5-layout');
  });

  it('mobile keys keep the -mobile. suffix consumers detect', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const url = await uploadScreenshot(HASH, 'mobile', Buffer.from('x'), {
      hasBlobToken: true,
      upload,
      optimize: async (b) => ({ buffer: b, quality: 80, width: 390 } as never),
      seoName: 'bold-saas-hero',
    });
    expect(/-mobile\.webp$/.test(url)).toBe(true);
  });

  it('falls back to the legacy hash key without seoName', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    await uploadScreenshot(HASH, 'desktop', Buffer.from('x'), {
      hasBlobToken: true,
      upload,
      optimize: async (b) => ({ buffer: b, quality: 80, width: 1600 } as never),
    });
    expect(upload).toHaveBeenCalledWith(`layouts/${HASH}-desktop.webp`, expect.anything(), 'image/webp');
  });

  it('sanitizes seoName to a safe slug', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    await uploadScreenshot(HASH, 'desktop', Buffer.from('x'), {
      hasBlobToken: true,
      upload,
      optimize: async (b) => ({ buffer: b, quality: 80, width: 1600 } as never),
      seoName: 'Weird Name!!/with spaces',
    });
    const key = (upload.mock.calls[0] as string[])[0];
    expect(key).toBe('layouts/weird-name-with-spaces-a1b2c3d4-desktop.webp');
  });
});
