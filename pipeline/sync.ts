import type { IngestPayload } from '@/lib/ingest/schema';

// A seed/sample layout is identifiable by its picsum placeholder preview image.
export function isSeedLayout(previewImageKeys: string[]): boolean {
  return (previewImageKeys[0] ?? '').includes('picsum');
}

// A key needs uploading to prod Blob only if it's a local path (not already an
// http(s) URL — which is an existing Blob/absolute asset reachable from prod).
export function needsUpload(key: string): boolean {
  return !/^https?:\/\//.test(key);
}

export interface SyncRow {
  slug: string;
  title: string;
  description: string | null;
  type: string;
  niche: string | null;
  style: string | null;
  colors: string[];
  contentHash: string;
  perceptualHash: string | null;
  variant: { group?: string; columns?: number; icons?: 'none' | 'top' | 'left'; iconStyle?: 'circle' | 'plain' | 'number' } | null;
  seo: { metaTitle?: string; metaDescription?: string; ogImageKey?: string; keywords?: string[] } | null;
}

export interface ResolvedAssets {
  diviJsonBlobKey: string;
  previewImageKeys: string[];
  tags: { axis: 'type' | 'niche' | 'style' | 'feature'; slug: string }[];
}

// Build the ingest payload for a layout from its DB row + resolved (prod-Blob)
// asset keys. Mirrors what the pipeline's ingest step sends; validatorPassed is
// true because these rows already passed validation when first ingested.
export function buildSyncPayload(row: SyncRow, resolved: ResolvedAssets): IngestPayload {
  const variant =
    row.variant && row.variant.group && typeof row.variant.columns === 'number' && row.variant.icons
      ? { group: row.variant.group, columns: row.variant.columns, icons: row.variant.icons, iconStyle: row.variant.iconStyle }
      : undefined;
  return {
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    type: row.type,
    niche: row.niche ?? undefined,
    style: row.style ?? undefined,
    colors: row.colors ?? [],
    diviJsonBlobKey: resolved.diviJsonBlobKey,
    previewImageKeys: resolved.previewImageKeys,
    contentHash: row.contentHash,
    perceptualHash: row.perceptualHash ?? undefined,
    variant,
    validatorPassed: true,
    seo: row.seo ?? undefined,
    tags: resolved.tags,
  };
}
