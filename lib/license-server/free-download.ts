// Retired. This route once served the AI Editor zip for free, because the AI Editor was one plugin whose premium tools
// were licence-gated at runtime. Today the free plugin is a separate download (/downloads/jhmg-ai-editor-for-divi-5.zip
// and wordpress.org) and `ai-editor-divi5-pro` is the PAID Pro add-on, whose zip must only ever be served by the
// key-authenticated /api/plugin/download route. No product may be listed here.
export const FREE_DOWNLOAD_PRODUCTS: readonly string[] = [];

type LatestRelease = (product: string) => Promise<{ version: string; blobKey: string; changelog: string | null } | null>;

export async function freeDownloadTarget(
  product: string,
  latestRelease: LatestRelease,
): Promise<{ ok: true; url: string } | { ok: false; status: 404 }> {
  if (!FREE_DOWNLOAD_PRODUCTS.includes(product)) return { ok: false, status: 404 };
  const release = await latestRelease(product);
  if (!release) return { ok: false, status: 404 };
  return { ok: true, url: release.blobKey };
}
