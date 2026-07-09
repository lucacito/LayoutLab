import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { uploadAsset } from '@/lib/blob';
import { optimizeScreenshot, type OptimizedScreenshot } from '@/pipeline/optimize-image';

// Persist a rendered screenshot and return its preview key. The raw Playwright
// PNG is always compressed to WebP (≤1600px wide, ~≤250KB) first — blobs are
// served directly by the site (next/image `unoptimized`), so what's uploaded
// here is exactly what buyers download over the wire. With a Blob token →
// `layouts/<hash>-<label>.webp` (a real-screenshot key). Locally → written to
// public/screenshots and served as `/screenshots/<hash>-<label>.webp`. Both are
// recognized by PreviewImage's isRealScreenshot.
export async function uploadScreenshot(
  hash: string,
  label: string,
  data: Buffer,
  deps: {
    hasBlobToken: boolean;
    publicDir?: string;
    upload?: (key: string, data: Buffer, ct: string) => Promise<{ url: string }>;
    writeFile?: (path: string, data: Buffer) => void;
    optimize?: (png: Buffer) => Promise<OptimizedScreenshot>;
    /** Descriptive stem (usually the layout's final slug) for a keyword-rich
     * filename — Google Images reads filenames. An 8-char hash prefix keeps
     * keys unique/idempotent; the label stays LAST so `-mobile.` detection in
     * PreviewImage/ResponsivePreview keeps working. Omitted → legacy hash key. */
    seoName?: string;
  },
): Promise<string> {
  const { buffer } = await (deps.optimize ?? optimizeScreenshot)(data);
  const stem = deps.seoName
    ? `${deps.seoName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${hash.slice(0, 8)}`
    : hash;
  const file = `${stem}-${label}.webp`;
  if (deps.hasBlobToken) {
    const key = `layouts/${file}`;
    // Store the real public Blob URL (not the key) — Vercel Blob URLs are
    // `https://<id>.public.blob.vercel-storage.com/...`, not a guessable base.
    const { url } = await (deps.upload ?? ((k, d, ct) => uploadAsset(k, d, ct)))(key, buffer, 'image/webp');
    return url;
  }
  const dir = deps.publicDir ?? 'public/screenshots';
  const write = deps.writeFile ?? ((p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); });
  write(`${dir}/${file}`, buffer);
  return `/screenshots/${file}`;
}

export interface UploadResult {
  diviJsonBlobKey: string;
  previewImageKeys: string[];
}

// Phase 3a previews are placeholders (same shape as the seed). Phase 3b replaces
// these with real Playwright screenshots uploaded to Blob.
export function previewUrls(hash: string, n = 3): string[] {
  return Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${hash}-${i}/1200/900`);
}

export async function uploadLayout(
  hash: string,
  json: string,
  deps: {
    hasBlobToken: boolean;
    outDir: string;
    upload?: (key: string, data: Buffer, ct: string) => Promise<{ url: string }>;
    writeFile?: (path: string, data: string) => void;
  },
): Promise<UploadResult> {
  const previewImageKeys = previewUrls(hash);
  if (deps.hasBlobToken) {
    const key = `layouts/${hash}.json`;
    const upload = deps.upload ?? ((k, d, ct) => uploadAsset(k, d, ct));
    const { url } = await upload(key, Buffer.from(json), 'application/json');
    return { diviJsonBlobKey: url, previewImageKeys };
  }
  const path = `${deps.outDir}/${hash}.json`;
  const write = deps.writeFile ?? ((p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); });
  write(path, json);
  return { diviJsonBlobKey: path, previewImageKeys };
}
