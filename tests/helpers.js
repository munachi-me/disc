import { createTrack } from '@/lib/music-providers/model';

let n = 0;
/** A valid, playable (full) track by default. Override any field. */
export function makeTrack(over = {}) {
  n += 1;
  return createTrack({
    provider: 'jamendo',
    providerTrackId: over.providerTrackId ?? `t${n}`,
    title: `Track ${n}`,
    artists: [{ id: 'jamendo:a1', name: 'Artist One' }],
    album: { id: 'jamendo:al1', title: 'Album One' },
    artworkUrl: 'https://usercontent.jamendo.com/a.jpg',
    duration: 200,
    streamUrl: `https://prod-1.storage.jamendo.com/?trackid=${n}`,
    genres: ['Electronic'],
    attribution: 'test',
    ...over,
  });
}

export const makeList = (count, over = {}) => Array.from({ length: count }, () => makeTrack(over));

export function jsonResponse(body, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
