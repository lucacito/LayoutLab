import { fetchAsset } from '@/lib/blob';
import { toDiviPortability } from './portability';

/**
 * A pack page can have a second file next to its stored layout: the same page in Divi's import format with the pack's
 * global colors and module presets already in (built by the validator's globalize/presetize steps, published by
 * scripts/portable-publish.ts). It lives in the same Blob store as the layout, under a key made from the layout's
 * content hash, so it is as unguessable as the layout's own URL and identical on local and prod.
 * Nothing here is required: no file, or one that is not sound, falls back to the plain wrapped layout.
 */
export function portableUrl(diviJsonBlobKey: string, contentHash: string | null | undefined): string | null {
  if (!contentHash || !/^[0-9a-f]{16,128}$/i.test(contentHash)) return null;
  try {
    const u = new URL(diviJsonBlobKey);
    if (u.protocol !== 'https:') return null;
    return `${u.origin}/portable/${contentHash}.json`;
  } catch {
    return null;
  }
}

/** True for a file Divi's importer will take: context et_builder and a page with content. */
export function isSoundPortable(text: string): boolean {
  try {
    const f = JSON.parse(text) as { context?: unknown; data?: unknown };
    if (!f || typeof f !== 'object' || f.context !== 'et_builder') return false;
    if (!f.data || typeof f.data !== 'object') return false;
    const pages = Object.values(f.data as Record<string, { post_content?: unknown }>);
    return pages.length > 0 && pages.every((p) => !!p && typeof p.post_content === 'string' && p.post_content.length > 0);
  } catch {
    return false;
  }
}

/** The file a buyer gets for a layout, and whether it carries the pack's colors and presets. */
export async function diviFileFor(
  layout: { diviJsonBlobKey: string; contentHash?: string | null },
  stored: string,
): Promise<{ json: string; portable: boolean }> {
  const url = portableUrl(layout.diviJsonBlobKey, layout.contentHash);
  if (url) {
    const bytes = await fetchAsset(url);
    const text = bytes?.toString('utf8');
    if (text && isSoundPortable(text)) return { json: text, portable: true };
  }
  return { json: toDiviPortability(stored), portable: false };
}
