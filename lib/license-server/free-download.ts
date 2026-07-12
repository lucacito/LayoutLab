// The AI Editor is distributed as a single zip whose premium tools are
// license-gated at runtime, so the zip itself is free to download (the email
// capture on the product page is a soft gate, same as free layouts). Converter
// Pro zips are NOT free — they stay behind the key-authenticated download route.
export const FREE_DOWNLOAD_PRODUCTS = ['ai-editor-divi5-pro'] as const;

type LatestRelease = (product: string) => Promise<{ version: string; blobKey: string; changelog: string | null } | null>;

export async function freeDownloadTarget(
  product: string,
  latestRelease: LatestRelease,
): Promise<{ ok: true; url: string } | { ok: false; status: 404 }> {
  if (!(FREE_DOWNLOAD_PRODUCTS as readonly string[]).includes(product)) return { ok: false, status: 404 };
  const release = await latestRelease(product);
  if (!release) return { ok: false, status: 404 };
  return { ok: true, url: release.blobKey };
}
