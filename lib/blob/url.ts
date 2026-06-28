const BLOB_PUBLIC_BASE = 'https://blob.vercel-storage.com';

// Phase 1: seed stores absolute placeholder URLs directly; the pipeline will
// later store bare blob keys. assetUrl normalizes both to a renderable URL.
export function assetUrl(key: string): string {
  if (/^https?:\/\//.test(key)) return key;
  return `${BLOB_PUBLIC_BASE}/${key.replace(/^\/+/, '')}`;
}
