/**
 * Small in-memory TTL cache for GET endpoints that change rarely (banners,
 * categories, feature flags). Also dedupes concurrent calls for the same key
 * so multiple components mounting at once only trigger one network request.
 * Lives only for the process lifetime — not persisted, no eviction needed at
 * this app's scale.
 */
type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function withTtlCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = fetcher()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateTtlCache(key: string): void {
  cache.delete(key);
}
