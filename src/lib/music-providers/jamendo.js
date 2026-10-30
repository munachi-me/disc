import { fetchJson, ProviderError } from '@/lib/utilities/http';
import { compact, createAlbum, createArtist, createTrack } from './model';

const BASE = 'https://api.jamendo.com/v3.0';
const ID_RE = /^\d{1,12}$/;

const AUDIO_FORMAT = { high: 'mp32', standard: 'mp31' };

export function normalizeJamendoTrack(r) {
  if (!r || r.id == null) return null;
  const genres = r.musicinfo?.tags?.genres;
  const license = r.license_ccurl || null;
  return createTrack({
    provider: 'jamendo',
    providerTrackId: r.id,
    title: r.name,
    artists: [{ id: r.artist_id ? `jamendo:${r.artist_id}` : undefined, name: r.artist_name }],
    album: r.album_id ? { id: `jamendo:${r.album_id}`, title: r.album_name } : null,
    artworkUrl: r.image || r.album_image,
    duration: r.duration,
    previewUrl: null,
    streamUrl: r.audio,
    externalUrl: r.shareurl,
    genres: Array.isArray(genres) ? genres : [],
    releaseDate: r.releasedate,
    explicit: null,
    license,
    attribution: `“${r.name}” by ${r.artist_name} via Jamendo${license ? ` — licensed under ${license}` : ''}`,
    playabilityReason: r.audio ? null : 'Jamendo did not return a stream for this track.',
    extra: { audiodownloadAllowed: r.audiodownload_allowed, position: r.position },
  });
}

export function normalizeJamendoAlbum(r) {
  if (!r || r.id == null) return null;
  return createAlbum({
    provider: 'jamendo',
    providerId: r.id,
    title: r.name,
    artists: [{ id: r.artist_id ? `jamendo:${r.artist_id}` : undefined, name: r.artist_name }],
    artworkUrl: r.image,
    releaseDate: r.releasedate,
    externalUrl: r.shareurl,
    attribution: 'Album on Jamendo. Tracks are licensed individually under Creative Commons.',
  });
}

export function normalizeJamendoArtist(r) {
  if (!r || r.id == null) return null;
  return createArtist({ provider: 'jamendo', providerId: r.id, name: r.name, artworkUrl: r.image, externalUrl: r.shareurl });
}

function rows(json) {
  if (!json || typeof json !== 'object' || !json.headers) throw new ProviderError('invalid', 'Unexpected response from Jamendo.', { provider: 'jamendo' });
  if (json.headers.status !== 'success') {
    const code = Number(json.headers.code);
    // Jamendo uses 5/10 for rejected or missing client ids.
    if (code === 5 || code === 10) throw new ProviderError('credentials', 'Jamendo rejected the client id. Check JAMENDO_CLIENT_ID in .env.local.', { provider: 'jamendo' });
    throw new ProviderError('http', json.headers.error_message || 'Jamendo returned an error.', { provider: 'jamendo' });
  }
  if (!Array.isArray(json.results)) throw new ProviderError('invalid', 'Unexpected response from Jamendo.', { provider: 'jamendo' });
  return json.results;
}

function build(path, ctx, params) {
  const id = ctx.env?.JAMENDO_CLIENT_ID;
  if (!id) throw new ProviderError('credentials', 'Jamendo needs JAMENDO_CLIENT_ID in .env.local.', { provider: 'jamendo' });
  const q = new URLSearchParams({ client_id: id, format: 'json', audioformat: AUDIO_FORMAT[ctx.quality] || 'mp32', imagesize: '400', ...params });
  return `${BASE}${path}?${q.toString()}`;
}

export const jamendo = {
  id: 'jamendo',
  name: 'Jamendo',
  description: 'Full-length, Creative Commons-licensed music. Needs a free client id.',
  requiresKey: true,
  playback: 'full',
  capabilities: { tracks: true, albums: true, artists: true, browse: true },
  isConfigured: (env) => Boolean(env?.JAMENDO_CLIENT_ID),

  async search({ query, types = ['tracks', 'albums', 'artists'], limit = 12, offset = 0 }, ctx) {
    const out = { tracks: [], albums: [], artists: [] };
    const common = { limit: String(limit), offset: String(offset) };
    await Promise.all([
      types.includes('tracks') &&
        fetchJson(build('/tracks/', ctx, { ...common, search: query, include: 'musicinfo', order: 'relevance' }), { ...ctx, provider: 'jamendo' }).then((j) => {
          out.tracks = compact(rows(j).map(normalizeJamendoTrack));
        }),
      types.includes('albums') &&
        fetchJson(build('/albums/', ctx, { ...common, namesearch: query }), { ...ctx, provider: 'jamendo' }).then((j) => {
          out.albums = compact(rows(j).map(normalizeJamendoAlbum));
        }),
      types.includes('artists') &&
        fetchJson(build('/artists/', ctx, { ...common, namesearch: query }), { ...ctx, provider: 'jamendo' }).then((j) => {
          out.artists = compact(rows(j).map(normalizeJamendoArtist));
        }),
    ].filter(Boolean));
    return out;
  },

  /** tags: genre/mood tags; order: 'popularity_week' | 'releasedate_desc' | 'relevance' | ... */
  async browse({ tags, term, order = 'popularity_week', limit = 20, offset = 0 }, ctx) {
    const params = { limit: String(limit), offset: String(offset), include: 'musicinfo', order };
    if (tags?.length) params.tags = tags.join('+');
    else if (term) params.search = term;
    return compact(rows(await fetchJson(build('/tracks/', ctx, params), { ...ctx, provider: 'jamendo' })).map(normalizeJamendoTrack));
  },

  async getAlbum(providerId, ctx) {
    if (!ID_RE.test(providerId)) throw new ProviderError('invalid', 'Invalid album id.', { provider: 'jamendo' });
    const [albumJson, trackJson] = await Promise.all([
      fetchJson(build('/albums/', ctx, { id: providerId }), { ...ctx, provider: 'jamendo' }),
      fetchJson(build('/tracks/', ctx, { album_id: providerId, limit: '100', include: 'musicinfo', order: 'track_position' }), { ...ctx, provider: 'jamendo' }),
    ]);
    const album = normalizeJamendoAlbum(rows(albumJson)[0]);
    if (!album) throw new ProviderError('invalid', 'Album not found.', { provider: 'jamendo', status: 404 });
    const tracks = compact(rows(trackJson).map(normalizeJamendoTrack));
    return { album: { ...album, trackCount: tracks.length || null }, tracks };
  },

  async getArtist(providerId, ctx) {
    if (!ID_RE.test(providerId)) throw new ProviderError('invalid', 'Invalid artist id.', { provider: 'jamendo' });
    const [artistJson, trackJson, albumJson] = await Promise.all([
      fetchJson(build('/artists/', ctx, { id: providerId }), { ...ctx, provider: 'jamendo' }),
      fetchJson(build('/tracks/', ctx, { artist_id: providerId, limit: '30', include: 'musicinfo', order: 'popularity_total' }), { ...ctx, provider: 'jamendo' }),
      fetchJson(build('/albums/', ctx, { artist_id: providerId, limit: '30' }), { ...ctx, provider: 'jamendo' }),
    ]);
    const artist = normalizeJamendoArtist(rows(artistJson)[0]);
    if (!artist) throw new ProviderError('invalid', 'Artist not found.', { provider: 'jamendo', status: 404 });
    return { artist, tracks: compact(rows(trackJson).map(normalizeJamendoTrack)), albums: compact(rows(albumJson).map(normalizeJamendoAlbum)), related: [] };
  },
};
