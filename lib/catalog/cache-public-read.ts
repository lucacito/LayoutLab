import { unstable_cache } from 'next/cache';

/** Public display data only. Commerce, authorization, and admin reads stay live.
 * Revalidation is request-driven: the first request after 300s may receive stale
 * data while Next refreshes it in the background. This is not a polling timer.
 */
export function cachePublicRead<Args extends unknown[], Result>(
  name: string,
  read: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  // Next's Data Cache JSON-serializes values. Preserve Drizzle Date fields so
  // existing callers can still use toISOString()/getTime() on cache hits.
  const cached = unstable_cache(async (...args: Args) => {
    return JSON.stringify(await read(...args), function (key, value) {
      const original = this[key];
      return original instanceof Date ? { __publicCatalogDate: original.toISOString() } : value;
    });
  }, ['public-catalog-v1', name], { revalidate: 300 });

  return async (...args: Args) => JSON.parse(await cached(...args), (_key, value) => {
    if (value && typeof value === 'object' && Object.keys(value).length === 1
      && typeof value.__publicCatalogDate === 'string') {
      return new Date(value.__publicCatalogDate);
    }
    return value;
  }) as Result;
}
