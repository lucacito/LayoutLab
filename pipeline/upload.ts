import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { uploadAsset } from '@/lib/blob';

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
