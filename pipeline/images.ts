// Post-generation image resolution: swap the keyword placeholder URLs the model
// writes (https://loremflickr.com/{w}/{h}/{keyword}) for real, relevant stock
// photos from Pexels searched on that keyword. Keeps the model's keyword intent
// but ships finished-looking sections. Falls back to the placeholder on any miss.

const PLACEHOLDER_RE = /https?:\/\/loremflickr\.com\/(\d+)\/(\d+)\/([^"'\\)\s]+)/g;

export interface ImageSearcher {
  /** Up to `count` photo URLs for the query at the given orientation (best-effort; [] on failure). */
  search(query: string, opts: { orientation: 'landscape' | 'portrait' | 'square'; count: number }): Promise<string[]>;
}

function orientationFor(w: number, h: number): 'landscape' | 'portrait' | 'square' {
  if (w > h * 1.15) return 'landscape';
  if (h > w * 1.15) return 'portrait';
  return 'square';
}

/** Replace loremflickr placeholders in a post_content string with real photo URLs. */
export async function resolveImages(postContent: string, searcher: ImageSearcher): Promise<string> {
  const matches = [...postContent.matchAll(PLACEHOLDER_RE)];
  if (!matches.length) return postContent;

  // Search each unique (query, orientation) once; pool the results.
  const pools = new Map<string, string[]>();
  for (const m of matches) {
    const query = decodeURIComponent(m[3]).replace(/[,+_-]+/g, ' ').trim();
    const orientation = orientationFor(Number(m[1]), Number(m[2]));
    const key = `${orientation}:${query}`;
    if (!pools.has(key)) pools.set(key, await searcher.search(query, { orientation, count: 8 }));
  }

  // Assign photos per occurrence, cycling within a pool for variety.
  const used = new Map<string, number>();
  let out = '';
  let last = 0;
  for (const m of matches) {
    const query = decodeURIComponent(m[3]).replace(/[,+_-]+/g, ' ').trim();
    const orientation = orientationFor(Number(m[1]), Number(m[2]));
    const key = `${orientation}:${query}`;
    const pool = pools.get(key) ?? [];
    const replacement = pool.length ? pool[(used.get(key) ?? 0) % pool.length] : m[0];
    used.set(key, (used.get(key) ?? 0) + 1);
    out += postContent.slice(last, m.index) + replacement;
    last = (m.index ?? 0) + m[0].length;
  }
  return out + postContent.slice(last);
}

/** Resolve images inside a full generated layout JSON ({ post_content, … }). */
export async function resolveLayoutImages(json: string, searcher: ImageSearcher): Promise<string> {
  let obj: { post_content?: string };
  try {
    obj = JSON.parse(json);
  } catch {
    return json;
  }
  if (typeof obj.post_content !== 'string') return json;
  obj.post_content = await resolveImages(obj.post_content, searcher);
  return JSON.stringify(obj);
}

/** Pexels-backed searcher (server-only; needs PEXELS_API_KEY). Caches per query+orientation. */
export function pexelsSearcher(apiKey: string): ImageSearcher {
  const cache = new Map<string, string[]>();
  return {
    async search(query, { orientation, count }) {
      const key = `${orientation}:${query}`;
      const cached = cache.get(key);
      if (cached) return cached;
      try {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${Math.max(count, 5)}`;
        const res = await fetch(url, { headers: { Authorization: apiKey } });
        if (!res.ok) return [];
        const j = (await res.json()) as { photos?: { src?: Record<string, string> }[] };
        const urls = (j.photos ?? []).map((p) => p.src?.large2x ?? p.src?.large ?? '').filter(Boolean);
        cache.set(key, urls);
        return urls;
      } catch {
        return [];
      }
    },
  };
}
