import { create } from 'zustand';
import { randomId } from '@/lib/utilities/ids';
import { clampStr, sanitizeAlbum, sanitizeArtist, sanitizeCover, sanitizeTrack } from './sanitize';

export const HISTORY_LIMIT = 3000;
export const SEARCH_LIMIT = 20;

export const initialData = () => ({
  favoriteTracks: {}, // id -> { item, addedAt }
  savedAlbums: {},
  followedArtists: {},
  playlists: [], // { id, name, description, coverUrl, favorite, generated, createdAt, updatedAt, tracks: [{ pid, track, addedAt }] }
  history: [], // newest first: { id, key, track, playedAt, listenedSec, completed }
  skips: {}, // track id -> count of early skips
  searches: [], // newest first: { q, at }
  localTracks: [], // imported file tracks
  onboarding: { done: false, genres: [], artists: [] },
  recentRecs: {}, // track id -> times shown in recommendations (used to avoid endless repeats)
});

const DATA_KEYS = Object.keys(initialData());
const now = () => Date.now();

function toggleIn(map, id, item) {
  const next = { ...map };
  if (next[id]) delete next[id];
  else next[id] = { item, addedAt: now() };
  return next;
}

/** Pick only the persisted data keys out of the full store state. */
export function selectData(state) {
  const out = {};
  for (const k of DATA_KEYS) out[k] = state[k];
  return out;
}

export const useLibrary = create((set, get) => ({
  ...initialData(),
  hydrated: false,
  storageError: null,

  // ---- favorites / albums / artists ----
  toggleFavorite(track) {
    const t = sanitizeTrack(track);
    if (!t) return false;
    set((s) => ({ favoriteTracks: toggleIn(s.favoriteTracks, t.id, t) }));
    return Boolean(get().favoriteTracks[t.id]);
  },
  toggleSaveAlbum(album) {
    const a = sanitizeAlbum(album);
    if (!a) return false;
    set((s) => ({ savedAlbums: toggleIn(s.savedAlbums, a.id, a) }));
    return Boolean(get().savedAlbums[a.id]);
  },
  toggleFollowArtist(artist) {
    const a = sanitizeArtist(artist);
    if (!a) return false;
    set((s) => ({ followedArtists: toggleIn(s.followedArtists, a.id, a) }));
    return Boolean(get().followedArtists[a.id]);
  },

  // ---- playlists ----
  createPlaylist({ name, description = '', tracks = [], generated = false, coverUrl = null } = {}) {
    const id = randomId('pl');
    const t = now();
    const clean = tracks.map(sanitizeTrack).filter(Boolean);
    const seen = new Set();
    const items = clean.filter((x) => (seen.has(x.id) ? false : seen.add(x.id))).map((track) => ({ pid: randomId('pt'), track, addedAt: t }));
    set((s) => ({
      playlists: [
        {
          id,
          name: clampStr(name, 80) || 'New playlist',
          description: clampStr(description, 300),
          coverUrl: sanitizeCover(coverUrl),
          favorite: false,
          generated: Boolean(generated),
          createdAt: t,
          updatedAt: t,
          tracks: items,
        },
        ...s.playlists,
      ],
    }));
    return id;
  },
  updatePlaylist(id, patch) {
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              ...(patch.name !== undefined ? { name: clampStr(patch.name, 80) || p.name } : {}),
              ...(patch.description !== undefined ? { description: clampStr(patch.description, 300) } : {}),
              ...(patch.coverUrl !== undefined ? { coverUrl: sanitizeCover(patch.coverUrl) } : {}),
              updatedAt: now(),
            },
      ),
    }));
  },
  renamePlaylist(id, name) {
    get().updatePlaylist(id, { name });
  },
  /** Returns how many tracks were added (tracks already in the playlist are skipped). */
  addTracksToPlaylist(id, tracks) {
    let added = 0;
    set((s) => ({
      playlists: s.playlists.map((p) => {
        if (p.id !== id) return p;
        const have = new Set(p.tracks.map((x) => x.track.id));
        const fresh = [];
        for (const raw of tracks) {
          const t = sanitizeTrack(raw);
          if (t && !have.has(t.id)) {
            have.add(t.id);
            fresh.push({ pid: randomId('pt'), track: t, addedAt: now() });
          }
        }
        added = fresh.length;
        return fresh.length ? { ...p, tracks: [...p.tracks, ...fresh], updatedAt: now() } : p;
      }),
    }));
    return added;
  },
  removeTrackFromPlaylist(id, pid) {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((x) => x.pid !== pid), updatedAt: now() } : p)) }));
  },
  moveTrackInPlaylist(id, from, to) {
    set((s) => ({
      playlists: s.playlists.map((p) => {
        if (p.id !== id || from === to || from < 0 || to < 0 || from >= p.tracks.length || to >= p.tracks.length) return p;
        const tracks = [...p.tracks];
        const [m] = tracks.splice(from, 1);
        tracks.splice(to, 0, m);
        return { ...p, tracks, updatedAt: now() };
      }),
    }));
  },
  duplicatePlaylist(id) {
    const src = get().playlists.find((p) => p.id === id);
    if (!src) return null;
    const newId = randomId('pl');
    const t = now();
    set((s) => ({
      playlists: [
        { ...src, id: newId, name: clampStr(`${src.name} (copy)`, 80), favorite: false, createdAt: t, updatedAt: t, tracks: src.tracks.map((x) => ({ ...x, pid: randomId('pt') })) },
        ...s.playlists,
      ],
    }));
    return newId;
  },
  deletePlaylist(id) {
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
  },
  togglePlaylistFavorite(id) {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)) }));
  },

  // ---- listening history ----
  recordPlay({ track, listenedSec = 0, completed = false, playedAt = now() }) {
    const t = sanitizeTrack(track);
    if (!t) return null;
    const id = randomId('h');
    set((s) => ({ history: [{ id, key: t.id, track: t, playedAt, listenedSec, completed }, ...s.history].slice(0, HISTORY_LIMIT) }));
    return id;
  },
  updatePlay(id, patch) {
    set((s) => ({ history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  },
  removeHistoryEntry(id) {
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },
  clearHistory() {
    set({ history: [], skips: {} });
  },
  recordSkip(track) {
    if (!track?.id) return;
    set((s) => ({ skips: { ...s.skips, [track.id]: Math.min(10, (s.skips[track.id] || 0) + 1) } }));
  },

  // ---- searches ----
  addSearch(q) {
    const text = clampStr(q, 100);
    if (text.length < 2) return;
    set((s) => ({ searches: [{ q: text, at: now() }, ...s.searches.filter((x) => x.q.toLowerCase() !== text.toLowerCase())].slice(0, SEARCH_LIMIT) }));
  },
  removeSearch(q) {
    set((s) => ({ searches: s.searches.filter((x) => x.q !== q) }));
  },
  clearSearches() {
    set({ searches: [] });
  },

  // ---- imported local tracks ----
  addLocalTrack(track) {
    const t = sanitizeTrack(track);
    if (!t || t.provider !== 'local') return null;
    set((s) => ({ localTracks: [t, ...s.localTracks.filter((x) => x.id !== t.id)] }));
    return t;
  },
  removeLocalTrack(id) {
    set((s) => ({
      localTracks: s.localTracks.filter((x) => x.id !== id),
      favoriteTracks: Object.fromEntries(Object.entries(s.favoriteTracks).filter(([k]) => k !== id)),
      playlists: s.playlists.map((p) => ({ ...p, tracks: p.tracks.filter((x) => x.track.id !== id) })),
    }));
  },

  // ---- onboarding / recommendation bookkeeping ----
  setOnboarding(patch) {
    set((s) => ({ onboarding: { ...s.onboarding, ...patch, genres: (patch.genres ?? s.onboarding.genres).slice(0, 12), artists: (patch.artists ?? s.onboarding.artists).slice(0, 12) } }));
  },
  noteRecommended(ids) {
    set((s) => {
      const next = { ...s.recentRecs };
      for (const id of ids) next[id] = Math.min(10, (next[id] || 0) + 1);
      const keys = Object.keys(next);
      if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete next[k];
      return { recentRecs: next };
    });
  },
  resetRecommendationMemory() {
    set({ recentRecs: {}, skips: {} });
  },

  // ---- bulk ----
  clearLibrary() {
    set({ ...initialData() });
  },
  /** Replace the data (used by hydration and import). */
  replaceData(data) {
    set({ ...initialData(), ...data });
  },
}));

/** Serialize for export. Imported audio files are NOT included (only their metadata is). */
export function exportLibrary(state = useLibrary.getState()) {
  const data = selectData(state);
  return { app: 'DISC', version: 1, exportedAt: new Date().toISOString(), data: { ...data, localTracks: [] } };
}

/** Validate and merge an exported file. Throws a readable Error on bad input. */
export function importLibrary(json, { mode = 'merge' } = {}) {
  if (!json || json.app !== 'DISC' || typeof json.data !== 'object' || json.data === null) throw new Error('This file is not a DISC library export.');
  const d = json.data;
  const mapOf = (obj, clean) => {
    const out = {};
    for (const v of Object.values(obj && typeof obj === 'object' ? obj : {})) {
      const item = clean(v?.item);
      if (item) out[item.id] = { item, addedAt: Number(v.addedAt) || Date.now() };
    }
    return out;
  };
  const playlists = (Array.isArray(d.playlists) ? d.playlists : []).slice(0, 200).map((p) => ({
    id: randomId('pl'),
    name: clampStr(p?.name, 80) || 'Imported playlist',
    description: clampStr(p?.description, 300),
    coverUrl: sanitizeCover(p?.coverUrl),
    favorite: Boolean(p?.favorite),
    generated: Boolean(p?.generated),
    createdAt: Number(p?.createdAt) || Date.now(),
    updatedAt: Date.now(),
    tracks: (Array.isArray(p?.tracks) ? p.tracks : []).slice(0, 2000).map((x) => ({ pid: randomId('pt'), track: sanitizeTrack(x?.track), addedAt: Number(x?.addedAt) || Date.now() })).filter((x) => x.track && x.track.provider !== 'local'),
  }));
  const history = (Array.isArray(d.history) ? d.history : []).slice(0, HISTORY_LIMIT).map((h) => ({ id: randomId('h'), key: String(h?.key || ''), track: sanitizeTrack(h?.track), playedAt: Number(h?.playedAt) || 0, listenedSec: Number(h?.listenedSec) || 0, completed: Boolean(h?.completed) })).filter((h) => h.track && h.playedAt && h.track.provider !== 'local');
  const incoming = {
    favoriteTracks: mapOf(d.favoriteTracks, sanitizeTrack),
    savedAlbums: mapOf(d.savedAlbums, sanitizeAlbum),
    followedArtists: mapOf(d.followedArtists, sanitizeArtist),
    playlists,
    history,
    searches: (Array.isArray(d.searches) ? d.searches : []).slice(0, SEARCH_LIMIT).map((x) => ({ q: clampStr(x?.q, 100), at: Number(x?.at) || Date.now() })).filter((x) => x.q),
  };
  const s = useLibrary.getState();
  if (mode === 'replace') {
    s.replaceData({ ...incoming, localTracks: s.localTracks });
  } else {
    const haveHistory = new Set(s.history.map((h) => `${h.key}@${h.playedAt}`));
    useLibrary.setState({
      favoriteTracks: { ...incoming.favoriteTracks, ...s.favoriteTracks },
      savedAlbums: { ...incoming.savedAlbums, ...s.savedAlbums },
      followedArtists: { ...incoming.followedArtists, ...s.followedArtists },
      playlists: [...s.playlists, ...incoming.playlists],
      history: [...s.history, ...incoming.history.filter((h) => !haveHistory.has(`${h.key}@${h.playedAt}`))].sort((a, b) => b.playedAt - a.playedAt).slice(0, HISTORY_LIMIT),
      searches: [...s.searches, ...incoming.searches.filter((x) => !s.searches.some((y) => y.q === x.q))].slice(0, SEARCH_LIMIT),
    });
  }
  return { favorites: Object.keys(incoming.favoriteTracks).length, albums: Object.keys(incoming.savedAlbums).length, artists: Object.keys(incoming.followedArtists).length, playlists: playlists.length, history: history.length };
}
