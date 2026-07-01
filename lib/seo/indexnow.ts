// IndexNow instant indexing (https://www.indexnow.org).
//
// When a layout is published, we push its URL to the IndexNow API, which fans
// out to Bing, Yandex, DuckDuckGo, Seznam, Naver and the shared IndexNow
// network — so new pages are discovered in seconds instead of waiting for a
// sitemap crawl. (Google deprecated its sitemap-ping endpoint in 2023 and does
// not participate in IndexNow, so this targets everyone else; Google still
// finds pages via the dynamic sitemap.)
//
// The key is public by design: it is served as a static text file at
// `/{INDEXNOW_KEY}.txt` (see `public/`) so the search engines can verify that
// whoever submitted the URLs controls the domain. Keep this constant and the
// filename of that public file in sync.

export const INDEXNOW_KEY = '9f3c1e7a4b2d8065f1a9c3e7b5d20486';

const ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Only submit for real, publicly-resolvable production hosts. Localhost,
 * loopback and Vercel preview deployments must never ping IndexNow (the URLs
 * aren't reachable and would pollute the index / waste quota).
 */
export function indexNowEnabled(siteUrl: string): boolean {
  let host: string;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    return false;
  }
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (host.endsWith('.local')) return false;
  if (host.endsWith('.vercel.app')) return false; // preview/branch deployments
  return true;
}

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function buildIndexNowPayload(siteUrl: string, urls: string[]): IndexNowPayload {
  const base = siteUrl.replace(/\/+$/, '');
  return {
    host: new URL(siteUrl).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
}

/**
 * Best-effort submission: never throws, so a failed ping can never break the
 * admin approve/publish action. Returns whether the submission was accepted.
 */
export async function submitToIndexNow(siteUrl: string, urls: string[]): Promise<boolean> {
  const urlList = urls.filter(Boolean);
  if (!urlList.length || !indexNowEnabled(siteUrl)) return false;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(buildIndexNowPayload(siteUrl, urlList)),
    });
    if (!res.ok) console.warn('[indexnow] non-OK response', res.status);
    return res.ok;
  } catch (err) {
    console.warn('[indexnow] submit failed', err);
    return false;
  }
}
