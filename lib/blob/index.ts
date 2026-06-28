import { put } from '@vercel/blob';

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

export { assetUrl } from './url';
