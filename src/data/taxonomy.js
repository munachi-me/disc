// Search recipes for genres, moods, activities and regions. They are NOT catalogs of songs:
// each entry only describes what to ask the music providers for.
// jamendoTags are Jamendo tag slugs; terms are free-text search terms for iTunes / Internet Archive.

export const GENRES = [
  { id: 'electronic', label: 'Electronic', term: 'electronic', jamendoTags: ['electronic'] },
  { id: 'ambient', label: 'Ambient', term: 'ambient', jamendoTags: ['ambient'] },
  { id: 'hiphop', label: 'Hip-Hop', term: 'hip hop', jamendoTags: ['hiphop'] },
  { id: 'rock', label: 'Rock', term: 'rock', jamendoTags: ['rock'] },
  { id: 'indie', label: 'Indie', term: 'indie', jamendoTags: ['indie'] },
  { id: 'jazz', label: 'Jazz', term: 'jazz', jamendoTags: ['jazz'] },
  { id: 'classical', label: 'Classical', term: 'classical', jamendoTags: ['classical'] },
  { id: 'pop', label: 'Pop', term: 'pop', jamendoTags: ['pop'] },
  { id: 'rnb', label: 'R&B / Soul', term: 'soul r&b', jamendoTags: ['rnb', 'soul'] },
  { id: 'folk', label: 'Folk', term: 'folk acoustic', jamendoTags: ['folk'] },
  { id: 'reggae', label: 'Reggae', term: 'reggae', jamendoTags: ['reggae'] },
  { id: 'metal', label: 'Metal', term: 'metal', jamendoTags: ['metal'] },
  { id: 'lofi', label: 'Lo-fi', term: 'lofi', jamendoTags: ['lofi'] },
  { id: 'world', label: 'World', term: 'world music', jamendoTags: ['world'] },
];

export const MOODS = [
  { id: 'chill', label: 'Chill', blurb: 'Low-tempo and easy.', term: 'chill', jamendoTags: ['chillout', 'relaxation'] },
  { id: 'focus', label: 'Focus', blurb: 'Steady and unobtrusive.', term: 'focus study instrumental', jamendoTags: ['ambient', 'instrumental'] },
  { id: 'workout', label: 'Workout', blurb: 'High energy and driving.', term: 'workout energy', jamendoTags: ['energetic', 'dance'] },
  { id: 'latenight', label: 'Late Night', blurb: 'Dark, slow and smoky.', term: 'late night jazz', jamendoTags: ['dark', 'lounge'] },
  { id: 'romantic', label: 'Romantic', blurb: 'Warm and close.', term: 'romantic love', jamendoTags: ['romantic', 'love'] },
  { id: 'happy', label: 'Happy', blurb: 'Bright and upbeat.', term: 'happy upbeat', jamendoTags: ['happy', 'positive'] },
  { id: 'melancholy', label: 'Melancholy', blurb: 'Reflective and wistful.', term: 'melancholy sad', jamendoTags: ['melancholic', 'sad'] },
  { id: 'party', label: 'Party', blurb: 'Dance-floor ready.', term: 'party dance', jamendoTags: ['party', 'dance'] },
  { id: 'instrumental', label: 'Instrumental', blurb: 'No vocals.', term: 'instrumental', jamendoTags: ['instrumental'] },
  { id: 'roadtrip', label: 'Road Trip', blurb: 'Windows down.', term: 'road trip driving', jamendoTags: ['rock', 'adventure'] },
];

export const ACTIVITIES = [
  { id: 'study', label: 'Study', mood: 'focus' },
  { id: 'gym', label: 'Gym', mood: 'workout' },
  { id: 'commute', label: 'Commute', mood: 'roadtrip' },
  { id: 'unwind', label: 'Unwind', mood: 'chill' },
  { id: 'dinner', label: 'Dinner', mood: 'romantic' },
];

export const REGIONS = [
  { id: 'afrobeats', label: 'Afrobeats', term: 'afrobeats' },
  { id: 'latin', label: 'Latin', term: 'latin' },
  { id: 'kpop', label: 'K-Pop', term: 'k-pop' },
  { id: 'bollywood', label: 'Bollywood', term: 'bollywood' },
  { id: 'bossa', label: 'Bossa Nova', term: 'bossa nova' },
  { id: 'amapiano', label: 'Amapiano', term: 'amapiano' },
  { id: 'jpop', label: 'J-Pop', term: 'j-pop' },
  { id: 'reggae-intl', label: 'Reggae & Dancehall', term: 'dancehall' },
];

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const GENRE_BY_ID = byId(GENRES);
export const MOOD_BY_ID = byId(MOODS);
export const REGION_BY_ID = byId(REGIONS);

/** Turn a discovery recipe into per-provider browse arguments. Returns null for unknown recipes. */
export function browseParams(kind, value) {
  if (kind === 'genre' && GENRE_BY_ID[value]) {
    const g = GENRE_BY_ID[value];
    return { label: g.label, params: { itunes: { term: g.term }, jamendo: { tags: g.jamendoTags }, archive: { term: g.term } } };
  }
  if (kind === 'mood' && MOOD_BY_ID[value]) {
    const m = MOOD_BY_ID[value];
    return { label: m.label, params: { itunes: { term: m.term }, jamendo: { tags: m.jamendoTags }, archive: { term: m.term } } };
  }
  if (kind === 'region' && REGION_BY_ID[value]) {
    const r = REGION_BY_ID[value];
    return { label: r.label, params: { itunes: { term: r.term }, jamendo: { term: r.term }, archive: { term: r.term } } };
  }
  if (kind === 'term' && typeof value === 'string') {
    const t = value.trim().slice(0, 60);
    if (t.length >= 2) return { label: t, params: { default: { term: t } } };
  }
  return null;
}
