import { createTtlCache } from '@/lib/utilities/cache';
import { enabledProviderIds, useSettings } from '@/lib/storage/settingsStore';

export class ApiError extends Error {
  constructor(message, { code = 'network', status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const cache = createTtlCache({ ttlMs: 3 * 60_000, max: 150 });
export const clearApiCache = () => cache.clear();

/** GET a same-origin /api path. Successful responses are cached briefly; failures never are. */
export async function apiGet(path, params = {}, { signal, cache: useCache = true } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const url = `${path}?${qs.toString()}`;
  if (useCache) {
    const hit = cache.get(url);
    if (hit) return hit;
  }
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('You appear to be offline, or DISC’s server is not reachable.', { code: 'network' });
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok) throw new ApiError(body?.error?.message || `Request failed (${res.status}).`, { code: body?.error?.code || 'http', status: res.status });
  if (!body || typeof body !== 'object') throw new ApiError('DISC received an unreadable response.', { code: 'invalid' });
  if (useCache) cache.set(url, body);
  return body;
}

/** Settings-derived params shared by every music request. */
export function musicParams() {
  const s = useSettings.getState();
  return { providers: enabledProviderIds(s).join(','), quality: s.quality };
}

export function filterExplicit(tracks) {
  return useSettings.getState().explicit === 'hide' ? tracks.filter((t) => t.explicit !== true) : tracks;
}

export async function searchMusic({ q, types, limit = 12 }, opts) {
  const params = musicParams();
  if (!params.providers) throw new ApiError('All music sources are switched off. Turn one on in Settings.', { code: 'no_providers' });
  const data = await apiGet('/api/music/search', { q, types: types?.join(','), limit, ...params }, opts);
  return { ...data, tracks: filterExplicit(data.tracks || []) };
}

export async function browseMusic({ kind, value, order, limit = 20, offset = 0, only }, opts) {
  const params = musicParams();
  if (only) params.providers = params.providers.split(',').filter((p) => only.includes(p)).join(',');
  if (!params.providers && only) return { tracks: [], errors: [], providers: [] };
  if (!params.providers) throw new ApiError('All music sources are switched off. Turn one on in Settings.', { code: 'no_providers' });
  const data = await apiGet('/api/music/browse', { kind, value, order, limit, offset, ...params }, opts);
  return { ...data, tracks: filterExplicit(data.tracks || []) };
}

export async function fetchAlbum(id, opts) {
  const data = await apiGet('/api/music/album', { id, quality: musicParams().quality }, opts);
  return { ...data, tracks: filterExplicit(data.tracks || []) };
}

export async function fetchArtist(id, opts) {
  const data = await apiGet('/api/music/artist', { id, quality: musicParams().quality }, opts);
  return { ...data, tracks: filterExplicit(data.tracks || []) };
}

export const fetchProviders = (opts) => apiGet('/api/music/providers', {}, opts);
export const fetchLyricsFor = ({ title, artist }, opts) => apiGet('/api/lyrics', { title, artist }, opts);
