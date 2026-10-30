import { fetchJson, ProviderError } from '@/lib/utilities/http';
import { compact, createAlbum, createArtist, createTrack } from './model';

const BASE = 'https://itunes.apple.com';
const ID_RE = /^\d{1,15}$/;

function country(env) {
  const c = String(env?.ITUNES_COUNTRY || 'US').toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : 'US';
}

function bigArt(url) {
  return typeof url === 'string' ? url.replace(/\/\d+x\d+(bb)?\.(jpg|png)/, '/600x600bb.$2') : null;
}

export function normalizeItunesTrack(r) {
  if (!r || r.wrapperType !== 'track' || r.kind !== 'song') return null;
  return createTrack({
    provider: 'itunes',
    providerTrackId: r.trackId,
    title: r.trackName,
    artists: [{ id: r.artistId ? `itunes:${r.artistId}` : undefined, name: r.artistName }],
    album: r.collectionId ? { id: `itunes:${r.collectionId}`, title: r.collectionName } : null,
    artworkUrl: bigArt(r.artworkUrl100),
    duration: r.trackTimeMillis ? r.trackTimeMillis / 1000 : null,
    previewUrl: r.previewUrl,
    streamUrl: null, // iTunes only supplies ~30 s previews; never a full stream
    externalUrl: r.trackViewUrl,
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    releaseDate: r.releaseDate,
    explicit: r.trackExplicitness ? r.trackExplicitness === 'explicit' : null,
    license: 'Preview clip provided by Apple. All rights reserved by the rights holders.',
    attribution: 'Preview and artwork provided by Apple (iTunes Search API).',
    extra: { trackNumber: r.trackNumber, discNumber: r.discNumber, collectionId: r.collectionId },
  });
}

export function normalizeItunesAlbum(r) {
  if (!r || r.wrapperType !== 'collection') return null;
  return createAlbum({
    provider: 'itunes',
    providerId: r.collectionId,
    title: r.collectionName,
    artists: [{ id: r.artistId ? `itunes:${r.artistId}` : undefined, name: r.artistName }],
    artworkUrl: bigArt(r.artworkUrl100),
    releaseDate: r.releaseDate,
    trackCount: r.trackCount,
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    externalUrl: r.collectionViewUrl,
    attribution: 'Artwork and metadata provided by Apple (iTunes Search API).',
  });
}

export function normalizeItunesArtist(r, artworkUrl = null) {
  if (!r || r.wrapperType !== 'artist') return null;
  return createArtist({
    provider: 'itunes',
    providerId: r.artistId,
    name: r.artistName,
    artworkUrl,
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    externalUrl: r.artistLinkUrl,
  });
}

function results(json, provider = 'itunes') {
  if (!json || !Array.isArray(json.results)) throw new ProviderError('invalid', 'Unexpected response from iTunes.', { provider });
  return json.results;
}

const ENTITY = { tracks: 'song', albums: 'album', artists: 'musicArtist' };

export const itunes = {
  id: 'itunes',
  name: 'iTunes',
  description: '30-second previews, artwork and metadata from Apple’s public Search API.',
  requiresKey: false,
  playback: 'preview',
  capabilities: { tracks: true, albums: true, artists: true, browse: true },
  isConfigured: () => true,

  async search({ query, types = ['tracks', 'albums', 'artists'], limit = 12, offset = 0 }, ctx) {
    const out = { tracks: [], albums: [], artists: [] };
    await Promise.all(
      types
        .filter((t) => ENTITY[t])
        .map(async (type) => {
          const url = `${BASE}/search?term=${encodeURIComponent(query)}&media=music&entity=${ENTITY[type]}&limit=${Math.min(limit + offset, 100)}&country=${country(ctx.env)}`;
          const rows = results(await fetchJson(url, { ...ctx, provider: 'itunes' })).slice(offset);
          if (type === 'tracks') out.tracks = compact(rows.map(normalizeItunesTrack));
          if (type === 'albums') out.albums = compact(rows.map(normalizeItunesAlbum));
          if (type === 'artists') out.artists = compact(rows.map((r) => normalizeItunesArtist(r)));
        }),
    );
    return out;
  },

  /** Genre / mood / term browsing via search. `sort: 'newest'` orders by release date. */
  async browse({ term, limit = 20, offset = 0, sort }, ctx) {
    const url = `${BASE}/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${Math.min(limit + offset, 200)}&country=${country(ctx.env)}`;
    let tracks = compact(results(await fetchJson(url, { ...ctx, provider: 'itunes' })).map(normalizeItunesTrack));
    if (sort === 'newest') tracks = tracks.sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)));
    return tracks.slice(offset, offset + limit);
  },

  async getAlbum(providerId, ctx) {
    if (!ID_RE.test(providerId)) throw new ProviderError('invalid', 'Invalid album id.', { provider: 'itunes' });
    const rows = results(await fetchJson(`${BASE}/lookup?id=${providerId}&entity=song&country=${country(ctx.env)}`, { ...ctx, provider: 'itunes' }));
    const album = normalizeItunesAlbum(rows.find((r) => r.wrapperType === 'collection'));
    if (!album) throw new ProviderError('invalid', 'Album not found.', { provider: 'itunes', status: 404 });
    const tracks = compact(rows.map(normalizeItunesTrack)).sort((a, b) => (a.extra.discNumber || 1) - (b.extra.discNumber || 1) || (a.extra.trackNumber || 0) - (b.extra.trackNumber || 0));
    return { album, tracks };
  },

  async getArtist(providerId, ctx) {
    if (!ID_RE.test(providerId)) throw new ProviderError('invalid', 'Invalid artist id.', { provider: 'itunes' });
    const [albumRows, songRows] = await Promise.all([
      fetchJson(`${BASE}/lookup?id=${providerId}&entity=album&limit=50&country=${country(ctx.env)}`, { ...ctx, provider: 'itunes' }),
      fetchJson(`${BASE}/lookup?id=${providerId}&entity=song&limit=15&country=${country(ctx.env)}`, { ...ctx, provider: 'itunes' }),
    ]);
    const aRows = results(albumRows);
    const albums = compact(aRows.map(normalizeItunesAlbum));
    const artist = normalizeItunesArtist(aRows.find((r) => r.wrapperType === 'artist'), albums[0]?.artworkUrl || null);
    if (!artist) throw new ProviderError('invalid', 'Artist not found.', { provider: 'itunes', status: 404 });
    const tracks = compact(results(songRows).map(normalizeItunesTrack));
    return { artist, albums, tracks, related: [] };
  },
};
