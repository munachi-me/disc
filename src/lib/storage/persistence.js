import { kvClear, kvGet, kvSet, filesClear, resetConnection } from './idb';
import { selectData, useLibrary, initialData } from './libraryStore';
import { sanitizeAlbum, sanitizeArtist, sanitizeTrack } from './sanitize';

const KEY = 'library';
const SCHEMA = 1;
let unsubscribe = null;
let timer = null;
let pending = false;
let started = false;

/** Re-validate whatever came out of IndexedDB so corrupted or hand-edited data can't break the UI. */
export function normalizeLoaded(raw) {
  const base = initialData();
  if (!raw || typeof raw !== 'object' || !raw.data) return base;
  const d = raw.data;
  const mapOf = (obj, clean) => {
    const out = {};
    for (const v of Object.values(obj && typeof obj === 'object' ? obj : {})) {
      const item = clean(v?.item);
      if (item) out[item.id] = { item, addedAt: Number(v.addedAt) || 0 };
    }
    return out;
  };
  return {
    ...base,
    favoriteTracks: mapOf(d.favoriteTracks, sanitizeTrack),
    savedAlbums: mapOf(d.savedAlbums, sanitizeAlbum),
    followedArtists: mapOf(d.followedArtists, sanitizeArtist),
    playlists: (Array.isArray(d.playlists) ? d.playlists : []).map((p) => ({ ...p, tracks: (Array.isArray(p.tracks) ? p.tracks : []).map((x) => ({ ...x, track: sanitizeTrack(x.track) })).filter((x) => x.track) })).filter((p) => p && p.id && p.name),
    history: (Array.isArray(d.history) ? d.history : []).map((h) => ({ ...h, track: sanitizeTrack(h.track) })).filter((h) => h.track && h.id),
    skips: d.skips && typeof d.skips === 'object' ? d.skips : {},
    searches: Array.isArray(d.searches) ? d.searches.filter((x) => x && typeof x.q === 'string') : [],
    localTracks: (Array.isArray(d.localTracks) ? d.localTracks : []).map(sanitizeTrack).filter(Boolean),
    onboarding: { ...base.onboarding, ...(d.onboarding || {}) },
    recentRecs: d.recentRecs && typeof d.recentRecs === 'object' ? d.recentRecs : {},
  };
}

export async function saveNow() {
  pending = false;
  clearTimeout(timer);
  try {
    await kvSet(KEY, { schema: SCHEMA, savedAt: Date.now(), data: selectData(useLibrary.getState()) });
    if (useLibrary.getState().storageError) useLibrary.setState({ storageError: null });
    return true;
  } catch (err) {
    useLibrary.setState({ storageError: err?.message || 'Could not save to browser storage. Your changes will be lost when you close this tab.' });
    return false;
  }
}

function schedule() {
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(saveNow, 250);
}

/** Load saved data, then start saving changes. Safe to call more than once. */
export async function startLibraryPersistence() {
  if (started) return;
  started = true;
  try {
    const raw = await kvGet(KEY);
    useLibrary.setState({ ...normalizeLoaded(raw), hydrated: true });
  } catch (err) {
    useLibrary.setState({ hydrated: true, storageError: `Browser storage is unavailable (${err?.message || 'unknown error'}). DISC will work, but nothing will be saved.` });
  }
  let prev = selectData(useLibrary.getState());
  unsubscribe = useLibrary.subscribe((state) => {
    const next = selectData(state);
    if (Object.keys(next).some((k) => next[k] !== prev[k])) {
      prev = next;
      schedule();
    }
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushOnHide);
  }
}

function flushOnHide() {
  if (pending) saveNow();
}

export function stopLibraryPersistence() {
  unsubscribe?.();
  unsubscribe = null;
  clearTimeout(timer);
  started = false;
  if (typeof window !== 'undefined') window.removeEventListener('pagehide', flushOnHide);
}

/** Erase everything DISC stored locally: library data, imported audio files and settings. */
export async function clearAllLocalData() {
  useLibrary.getState().clearLibrary();
  clearTimeout(timer);
  try {
    await kvClear();
    await filesClear();
  } catch {
    /* storage may be unavailable; in-memory state is already cleared */
  }
  try {
    localStorage.removeItem('disc-settings');
  } catch {
    /* ignore */
  }
  await resetConnection();
}
