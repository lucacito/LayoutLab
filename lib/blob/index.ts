import { put } from '@vercel/blob';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { assetUrl } from './url';

export async function uploadAsset(
  key: string,
  data: Buffer | Blob,
  contentType: string,
): Promise<{ url: string }> {
  const res = await put(key, data, { access: 'public', contentType, addRandomSuffix: false });
  return { url: res.url };
}

// Phase 0 baseline: assets are uploaded with stable keys; entitlement-gated
// access is enforced at the API layer (Phase 4 /api/download), which returns a
// short-lived redirect to the stored key. A true private+signed scheme can be
// layered in Phase 4 if asset privacy is required.
export async function signedDownloadUrl(key: string, _ttlSeconds = 300): Promise<string> {
  // TODO(Phase 4): switch to private blobs + generated signed URLs.
  return `https://blob.vercel-storage.com/${key}`;
}

// Reads an asset's bytes for the download route: a local pipeline file if the
// key is an existing local path, else fetches the resolved (Blob/absolute) URL.
// Returns null when the asset doesn't exist (→ route 404).
export async function fetchAsset(key: string): Promise<Buffer | null> {
  if (!key) return null;
  if (!/^https?:\/\//.test(key) && existsSync(key)) {
    return readFile(key).catch(() => null);
  }
  try {
    const res = await fetch(assetUrl(key));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export { assetUrl } from './url';
