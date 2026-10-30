import { fetchJson, ProviderError } from '@/lib/utilities/http';
import { cleanText } from '@/lib/utilities/url';
import { compact, createAlbum, createTrack } from './model';

const BASE = 'https://archive.org';
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const AUDIO_FORMATS = ['VBR MP3', 'MP3', '128Kbps MP3', '64Kbps MP3', '192Kbps MP3', '256Kbps MP3', '320Kbps MP3', 'Ogg Vorbis'];

const first = (v) => (Array.isArray(v) ? v[0] : v);

function parseLength(v) {
  if (v == null) return null;
  const s = String(v);
  if (s.includes(':')) return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0) || null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Only items that carry explicit license metadata are surfaced. Internet Archive items are NOT all free to use. */
export function normalizeArchiveAlbum(doc) {
  const id = first(doc?.identifier);
  const license = first(doc?.licenseurl);
  if (!id || !ID_RE.test(String(id)) || !license) return null;
  const creator = cleanText(first(doc.creator), 120);
  return createAlbum({
    provider: 'archive',
    providerId: id,
    title: first(doc.title),
    artists: [{ name: creator || 'Unknown artist' }],
    artworkUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
    releaseDate: first(doc.year) || first(doc.date),
    genres: (Array.isArray(doc.subject) ? doc.subject : doc.subject ? [doc.subject] : []).slice(0, 4),
    externalUrl: `${BASE}/details/${encodeURIComponent(id)}`,
    license,
    attribution: `“${cleanText(first(doc.title), 120)}” on the Internet Archive — license: ${license}`,
  });
}

/** Build tracks from /metadata/{id}. Picks one browser-playable file per recording. */
export function normalizeArchiveItem(json) {
  const meta = json?.metadata;
  const files = json?.files;
  if (!meta || !Array.isArray(files)) throw new ProviderError('invalid', 'Unexpected response from the Internet Archive.', { provider: 'archive' });
  const id = first(meta.identifier);
  const license = first(meta.licenseurl);
  if (!id || !ID_RE.test(String(id))) throw new ProviderError('invalid', 'Invalid item.', { provider: 'archive' });
  if (!license) throw new ProviderError('invalid', 'This item has no license metadata, so DISC will not present it as freely playable.', { provider: 'archive', status: 403 });

  const creator = cleanText(first(meta.creator), 120) || 'Unknown artist';
  const album = normalizeArchiveAlbum(meta);
  if (!album) throw new ProviderError('invalid', 'Item not usable.', { provider: 'archive' });

  const best = new Map();
  for (const f of files) {
    if (!f?.name || !AUDIO_FORMATS.includes(f.format)) continue;
    const key = String(f.original || f.name).replace(/\.[^.]+$/, '');
    const rank = AUDIO_FORMATS.indexOf(f.format);
    const cur = best.get(key);
    if (!cur || rank < cur.rank) best.set(key, { f, rank });
  }

  const tracks = compact(
    [...best.values()].map(({ f }, i) => {
      const url = `${BASE}/download/${encodeURIComponent(id)}/${String(f.name).split('/').map(encodeURIComponent).join('/')}`;
      const title = f.title || String(f.name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      return createTrack({
        provider: 'archive',
        providerTrackId: `${id}/${f.name}`,
        title,
        artists: [{ name: cleanText(f.artist, 120) || creator }],
        album: { id: album.id, title: album.title },
        artworkUrl: album.artworkUrl,
        duration: parseLength(f.length),
        streamUrl: url,
        externalUrl: album.externalUrl,
        genres: album.genres,
        releaseDate: album.releaseDate,
        license,
        attribution: album.attribution,
        extra: { trackNumber: Number(f.track) || i + 1, file: f.name },
      });
    }),
  ).sort((a, b) => a.extra.trackNumber - b.extra.trackNumber);

  return { album: { ...album, trackCount: tracks.length }, tracks };
}

export const archive = {
  id: 'archive',
  name: 'Internet Archive',
  description: 'Full-length audio from collections with explicit license metadata (e.g. Creative Commons). No key needed.',
  requiresKey: false,
  playback: 'full',
  capabilities: { tracks: false, albums: true, artists: false, browse: true },
  isConfigured: () => true,

  async search({ query, types = ['albums'], limit = 12, offset = 0 }, ctx) {
    const out = { tracks: [], albums: [], artists: [] };
    if (!types.includes('albums')) return out;
    out.albums = await this.searchAlbums({ query, limit, offset }, ctx);
    return out;
  },

  async searchAlbums({ query, limit = 12, offset = 0 }, ctx) {
    const safe = String(query).replace(/["\\()[\]{}:^~*?]/g, ' ').trim();
    const q = `${safe ? `(${safe}) AND ` : ''}mediatype:audio AND licenseurl:* AND collection:(netlabels OR opensource_audio OR audio_music)`;
    const params = new URLSearchParams({ q, rows: String(limit), page: String(Math.floor(offset / Math.max(limit, 1)) + 1), output: 'json' });
    for (const f of ['identifier', 'title', 'creator', 'licenseurl', 'year', 'subject']) params.append('fl[]', f);
    const json = await fetchJson(`${BASE}/advancedsearch.php?${params.toString()}`, { ...ctx, provider: 'archive' });
    if (!json?.response || !Array.isArray(json.response.docs)) throw new ProviderError('invalid', 'Unexpected response from the Internet Archive.', { provider: 'archive' });
    return compact(json.response.docs.map(normalizeArchiveAlbum));
  },

  async browse({ term, limit = 20, offset = 0 }, ctx) {
    const albums = await this.searchAlbums({ query: term || 'music', limit: Math.min(6, limit), offset }, ctx);
    const lists = await Promise.allSettled(albums.slice(0, 4).map((a) => this.getAlbum(a.providerId, ctx)));
    return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value.tracks.slice(0, 5) : [])).slice(0, limit);
  },

  async getAlbum(providerId, ctx) {
    if (!ID_RE.test(providerId)) throw new ProviderError('invalid', 'Invalid item id.', { provider: 'archive' });
    return normalizeArchiveItem(await fetchJson(`${BASE}/metadata/${encodeURIComponent(providerId)}`, { ...ctx, provider: 'archive', timeoutMs: ctx.timeoutMs || 10000 }));
  },

  async getArtist() {
    throw new ProviderError('invalid', 'The Internet Archive does not expose artist pages. Search by creator name instead.', { provider: 'archive', status: 404 });
  },
};

