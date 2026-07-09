import sharp from 'sharp';

// Lossy WebP refuses to encode any dimension above 16383px. Very tall
// full-landing mobile shots can exceed it, so tall images are scaled to fit.
export const WEBP_MAX_DIM = 16383;

export interface OptimizeOptions {
  /** Max output width; taller-than-wide inputs may come out narrower to respect WEBP_MAX_DIM. */
  maxWidth?: number;
  /** Byte budget; the quality ladder walks down until the encode fits. */
  maxBytes?: number;
  /** Descending WebP quality rungs. If even the last rung exceeds maxBytes, its result is returned anyway. */
  qualities?: number[];
}

export interface OptimizedScreenshot {
  buffer: Buffer;
  width: number;
  height: number;
  quality: number;
  format: 'webp';
}

// Screenshot compressor for everything the pipeline uploads to Blob: PNG (raw
// Playwright output) → WebP, capped at 1600px wide, targeting ≤250KB so the
// site can serve blobs directly (next/image `unoptimized`) without paying
// Vercel image-transformation quota or shipping multi-MB PNGs.
// Backfill helpers (scripts/optimize-live-images.ts): identify a Blob-hosted
// legacy PNG screenshot and name its WebP replacement (same path, new ext).
export function isBlobPngUrl(url: string): boolean {
  return /^https:\/\/([^/]+\.)?blob\.vercel-storage\.com\/.+\.png$/i.test(url);
}

export function webpKeyForBlobUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname).replace(/^\//, '').replace(/\.png$/i, '.webp');
}

export async function optimizeScreenshot(
  input: Buffer,
  opts: OptimizeOptions = {},
): Promise<OptimizedScreenshot> {
  const maxWidth = opts.maxWidth ?? 1600;
  const maxBytes = opts.maxBytes ?? 250 * 1024;
  const qualities = opts.qualities?.length ? opts.qualities : [82, 74, 66, 58, 50];

  let last: OptimizedScreenshot | undefined;
  for (const quality of qualities) {
    const { data, info } = await sharp(input)
      .resize({ width: maxWidth, height: WEBP_MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    last = { buffer: data, width: info.width, height: info.height, quality, format: 'webp' };
    if (data.length <= maxBytes) return last;
  }
  return last!;
}
