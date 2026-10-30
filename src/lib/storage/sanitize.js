import { createAlbum, createArtist, createTrack } from '@/lib/music-providers/model';
import { safeImageUrl } from '@/lib/utilities/url';

/** Re-validate a track object that came from storage or an imported file. Local tracks keep their file reference. */
export function sanitizeTrack(t) {
  if (!t || typeof t !== 'object') return null;
  if (t.provider === 'local') {
    if (!t.providerTrackId || !t.title) return null;
    const base = createTrack({ ...t, streamUrl: null, previewUrl: null });
    if (!base) return null;
    return { ...base, isPlayable: true, playbackType: 'full', playabilityReason: null, attribution: 'Imported from your device', extra: { fileId: String(t.extra?.fileId || t.providerTrackId) } };
  }
  return createTrack(t);
}

export function sanitizeAlbum(a) {
  return a && typeof a === 'object' ? createAlbum({ ...a, providerId: a.providerId }) : null;
}

export function sanitizeArtist(a) {
  return a && typeof a === 'object' ? createArtist({ ...a, providerId: a.providerId }) : null;
}

export function sanitizeCover(url) {
  if (typeof url !== 'string' || !url) return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length < 400_000) return url;
  return safeImageUrl(url);
}

export const clampStr = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
