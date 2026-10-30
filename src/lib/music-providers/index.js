import { ProviderError } from '@/lib/utilities/http';
import { createTtlCache } from '@/lib/utilities/cache';
import { dedupeKey, splitEntityId } from '@/lib/utilities/ids';
import { itunes } from './itunes';
import { jamendo } from './jamendo';
import { archive } from './archive';

/** Registry. Add a provider by creating a module with the same shape and listing it here. */
export const PROVIDERS = { itunes, jamendo, archive };
export const PROVIDER_IDS = Object.keys(PROVIDERS);

const cache = createTtlCache({ ttlMs: 5 * 60_000, max: 300 });
export const providerCache = cache;

export function describeProviders(env = process.env) {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    requiresKey: p.requiresKey,
    configured: p.isConfigured(env),
    playback: p.playback,
    capabilities: p.capabilities,
  }));
}

/** Providers that exist, are configured and (optionally) were requested. */
export function selectProviders(requested, env = process.env) {
  const ids = Array.isArray(requested) && requested.length ? requested : PROVIDER_IDS;
  return ids.filter((id) => PROVIDERS[id]).map((id) => PROVIDERS[id]);
}

function errorInfo(provider, err) {
  if (err instanceof ProviderError) return { provider: provider.id, name: provider.name, code: err.code, message: err.message };
  return { provider: provider.id, name: provider.name, code: 'network', message: `${provider.name} failed unexpectedly.` };
}

function interleave(lists, limit) {
  const out = [];
  const seen = new Set();
  for (let i = 0; out.length < limit; i++) {
    let any = false;
    for (const list of lists) {
      if (i < list.length) {
        any = true;
        const item = list[i];
        const key = item.title !== undefined && item.artists ? dedupeKey(item) : item.id;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(item);
          if (out.length >= limit) break;
        }
      }
    }
    if (!any) break;
  }
  return out;
}

/**
 * Run `fn` against several providers in parallel. One provider failing never breaks the others:
 * failures are returned in `errors` and the rest of the results are still delivered.
 */
async function fanOut(providers, cacheKey, fn, ctx) {
  const settled = await Promise.all(
    providers.map(async (p) => {
      if (!p.isConfigured(ctx.env)) {
        return { provider: p, error: errorInfo(p, new ProviderError('credentials', `${p.name} is not configured. Add its credentials to .env.local to enable it.`, { provider: p.id })), skipped: true };
      }
      try {
        const value = await cache.wrap(`${cacheKey}|${p.id}|${ctx.quality || ''}`, () => fn(p, ctx));
        return { provider: p, value };
      } catch (err) {
        if (err instanceof ProviderError && err.code === 'aborted') throw err;
        return { provider: p, error: errorInfo(p, err) };
      }
    }),
  );
  return settled;
}

/** Unified search across providers. */
export async function searchAll({ query, types = ['tracks', 'albums', 'artists'], providers, limit = 12, offset = 0 }, ctx = {}) {
  const c = { env: process.env, ...ctx };
  const selected = selectProviders(providers, c.env);
  const settled = await fanOut(selected, `search|${query}|${types}|${limit}|${offset}`, (p, cx) => p.search({ query, types, limit, offset }, cx), c);
  const ok = settled.filter((s) => s.value);
  return {
    tracks: interleave(ok.map((s) => s.value.tracks || []), limit * 2),
    albums: interleave(ok.map((s) => s.value.albums || []), limit),
    artists: interleave(ok.map((s) => s.value.artists || []), limit),
    errors: settled.filter((s) => s.error).map((s) => s.error),
    providers: ok.map((s) => s.provider.id),
  };
}

/** Browse tracks (genre/mood/etc). `params` maps provider id → browse args. */
export async function browseAll({ params, providers, limit = 20, offset = 0, order }, ctx = {}) {
  const c = { env: process.env, ...ctx };
  const selected = selectProviders(providers, c.env).filter((p) => p.capabilities.browse);
  const settled = await fanOut(
    selected,
    `browse|${JSON.stringify(params)}|${limit}|${offset}|${order || ''}`,
    (p, cx) => p.browse({ ...(params[p.id] || params.default || {}), limit, offset, ...(order && p.id === 'jamendo' ? { order } : {}) }, cx),
    c,
  );
  const ok = settled.filter((s) => s.value);
  return {
    tracks: interleave(ok.map((s) => s.value), limit),
    errors: settled.filter((s) => s.error).map((s) => s.error),
    providers: ok.map((s) => s.provider.id),
  };
}

export async function getAlbum(entityId, ctx = {}) {
  const c = { env: process.env, ...ctx };
  const parts = splitEntityId(entityId);
  const p = parts && PROVIDERS[parts.provider];
  if (!p) throw new ProviderError('invalid', 'Unknown album.', { status: 404 });
  if (!p.isConfigured(c.env)) throw new ProviderError('credentials', `${p.name} is not configured.`, { provider: p.id });
  return cache.wrap(`album|${entityId}|${c.quality || ''}`, () => p.getAlbum(parts.providerId, c));
}

export async function getArtist(entityId, ctx = {}) {
  const c = { env: process.env, ...ctx };
  const parts = splitEntityId(entityId);
  const p = parts && PROVIDERS[parts.provider];
  if (!p) throw new ProviderError('invalid', 'Unknown artist.', { status: 404 });
  if (!p.isConfigured(c.env)) throw new ProviderError('credentials', `${p.name} is not configured.`, { provider: p.id });
  return cache.wrap(`artist|${entityId}|${c.quality || ''}`, () => p.getArtist(parts.providerId, c));
}
