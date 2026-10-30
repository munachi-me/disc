import { cleanText, safeExternalUrl, safeImageUrl, safeMediaUrl } from '@/lib/utilities/url';
import { makeEntityId } from '@/lib/utilities/ids';

/**
 * @typedef {Object} ArtistRef
 * @property {string} [id]     Entity id ("provider:providerId") when the provider exposes artist pages
 * @property {string} name
 *
 * @typedef {Object} Track
 * @property {string} id                 "provider:providerTrackId" — stable and unique across providers
 * @property {string} provider           "itunes" | "jamendo" | "archive" | "local"
 * @property {string} providerTrackId
 * @property {string} title
 * @property {ArtistRef[]} artists
 * @property {{id?: string, title: string}|null} album
 * @property {string|null} artworkUrl
 * @property {number|null} duration      Seconds of the FULL recording when known (previews are shorter)
 * @property {string|null} previewUrl    Short preview clip (e.g. iTunes 30 s). Never a full track.
 * @property {string|null} streamUrl     Full-length stream, only when the provider licenses it
 * @property {string|null} externalUrl   Canonical page on the original platform
 * @property {string[]} genres
 * @property {string|null} releaseDate
 * @property {boolean|null} explicit     null when the provider does not say
 * @property {string|null} license       License name or URL
 * @property {string} attribution        Credit line to show in the UI
 * @property {boolean} isPlayable
 * @property {'full'|'preview'|'none'} playbackType
 * @property {string|null} playabilityReason  Explains why a track is preview-only or unavailable
 * @property {Object} extra              Provider-specific fields kept as-is
 *
 * @typedef {Object} Album
 * @property {string} id @property {string} provider @property {string} providerId
 * @property {string} title @property {ArtistRef[]} artists @property {string|null} artworkUrl
 * @property {string|null} releaseDate @property {number|null} trackCount @property {string[]} genres
 * @property {string|null} externalUrl @property {string|null} license @property {string} attribution
 *
 * @typedef {Object} Artist
 * @property {string} id @property {string} provider @property {string} providerId
 * @property {string} name @property {string|null} artworkUrl @property {string[]} genres
 * @property {string|null} externalUrl @property {string|null} bio
 */

const str = (v, max) => cleanText(v, max);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

function refList(list) {
  return (Array.isArray(list) ? list : [])
    .map((a) => ({ id: a?.id ? String(a.id) : undefined, name: str(a?.name, 120) }))
    .filter((a) => a.name);
}

/** Build a validated Track. Returns null when required fields are missing. */
export function createTrack(input) {
  if (!input || input.providerTrackId == null || input.providerTrackId === '' || !input.provider) return null;
  const title = str(input.title, 200);
  if (!title) return null;
  const streamUrl = safeMediaUrl(input.streamUrl);
  const previewUrl = safeMediaUrl(input.previewUrl);
  const artists = refList(input.artists);
  if (artists.length === 0) artists.push({ name: 'Unknown artist' });

  let playbackType = 'none';
  let playabilityReason = input.playabilityReason || null;
  if (streamUrl) {
    playbackType = 'full';
    playabilityReason = null;
  } else if (previewUrl) {
    playbackType = 'preview';
    playabilityReason = playabilityReason || 'Only a short preview is available. Open the track on its original platform to hear the full recording.';
  } else {
    playabilityReason = playabilityReason || 'The provider did not supply a playable URL for this track.';
  }

  return {
    id: makeEntityId(input.provider, input.providerTrackId),
    provider: input.provider,
    providerTrackId: String(input.providerTrackId),
    title,
    artists,
    album: input.album?.title ? { id: input.album.id ? String(input.album.id) : undefined, title: str(input.album.title, 200) } : null,
    artworkUrl: safeImageUrl(input.artworkUrl),
    duration: num(input.duration),
    previewUrl,
    streamUrl,
    externalUrl: safeExternalUrl(input.externalUrl),
    genres: (Array.isArray(input.genres) ? input.genres : []).map((g) => str(g, 60)).filter(Boolean).slice(0, 6),
    releaseDate: input.releaseDate ? str(input.releaseDate, 40) : null,
    explicit: typeof input.explicit === 'boolean' ? input.explicit : null,
    license: input.license ? str(input.license, 300) : null,
    attribution: str(input.attribution, 300),
    isPlayable: playbackType !== 'none',
    playbackType,
    playabilityReason,
    extra: input.extra && typeof input.extra === 'object' ? input.extra : {},
  };
}

export function createAlbum(input) {
  if (!input || input.providerId == null || input.providerId === '' || !input.provider) return null;
  const title = str(input.title, 200);
  if (!title) return null;
  return {
    id: makeEntityId(input.provider, input.providerId),
    provider: input.provider,
    providerId: String(input.providerId),
    title,
    artists: refList(input.artists),
    artworkUrl: safeImageUrl(input.artworkUrl),
    releaseDate: input.releaseDate ? str(input.releaseDate, 40) : null,
    trackCount: num(input.trackCount),
    genres: (Array.isArray(input.genres) ? input.genres : []).map((g) => str(g, 60)).filter(Boolean).slice(0, 6),
    externalUrl: safeExternalUrl(input.externalUrl),
    license: input.license ? str(input.license, 300) : null,
    attribution: str(input.attribution, 300),
  };
}

export function createArtist(input) {
  if (!input || input.providerId == null || input.providerId === '' || !input.provider) return null;
  const name = str(input.name, 120);
  if (!name) return null;
  return {
    id: makeEntityId(input.provider, input.providerId),
    provider: input.provider,
    providerId: String(input.providerId),
    name,
    artworkUrl: safeImageUrl(input.artworkUrl),
    genres: (Array.isArray(input.genres) ? input.genres : []).map((g) => str(g, 60)).filter(Boolean).slice(0, 6),
    externalUrl: safeExternalUrl(input.externalUrl),
    bio: input.bio ? str(input.bio, 2000) : null,
  };
}

export const compact = (list) => list.filter(Boolean);
