import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { uploadAsset } from '@/lib/blob';

// Persist a rendered screenshot and return its preview key. With a Blob token →
// `layouts/<hash>-<label>.png` (a real-screenshot key). Locally → written to
// public/screenshots and served as `/screenshots/<hash>-<label>.png`. Both are
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
  },
): Promise<string> {
  if (deps.hasBlobToken) {
    const key = `layouts/${hash}-${label}.png`;
    await (deps.upload ?? ((k, d, ct) => uploadAsset(k, d, ct)))(key, data, 'image/png');
    return key;
  }
  const dir = deps.publicDir ?? 'public/screenshots';
  const write = deps.writeFile ?? ((p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); });
  write(`${dir}/${hash}-${label}.png`, data);
  return `/screenshots/${hash}-${label}.png`;
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
    await upload(key, Buffer.from(json), 'application/json');
    return { diviJsonBlobKey: key, previewImageKeys };
  }
  const path = `${deps.outDir}/${hash}.json`;
  const write = deps.writeFile ?? ((p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); });
  write(path, json);
  return { diviJsonBlobKey: path, previewImageKeys };
}
