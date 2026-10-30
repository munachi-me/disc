/** Small TTL cache with in-flight de-duplication. */
export function createTtlCache({ ttlMs = 5 * 60_000, max = 200, now = () => Date.now() } = {}) {
  const store = new Map();
  const inflight = new Map();

  function get(key) {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= now()) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value) {
    if (store.size >= max) store.delete(store.keys().next().value);
    store.set(key, { value, expires: now() + ttlMs });
  }

  /** Return a cached value, or run `loader` once even if called concurrently. Failures are not cached. */
  async function wrap(key, loader) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve()
      .then(loader)
      .then((v) => {
        set(key, v);
        return v;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return { get, set, wrap, clear: () => store.clear(), size: () => store.size };
}
