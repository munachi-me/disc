import { create } from 'zustand';
import * as Q from './queue';
import { useSettings } from '@/lib/storage/settingsStore';
import { useLibrary } from '@/lib/storage/libraryStore';

/** Time/progress changes ~4x per second, so it lives in its own store to avoid re-rendering the whole UI. */
export const useProgress = create(() => ({ currentTime: 0, duration: 0, buffered: 0 }));

export const MAX_AUTO_SKIPS = 3;

export const initialPlayer = () => ({
  queue: [],
  currentQid: null,
  played: [],
  status: 'idle', // idle | loading | playing | paused | error
  intent: 'pause', // what the user wants: 'play' | 'pause'
  playToken: 0, // bump to (re)load the current item into the audio element
  error: null,
  notice: null, // transient message, e.g. "Skipped an unplayable track"
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  muted: false,
  expanded: false,
  queueOpen: false,
  failures: 0,
  source: null, // { type, id, name } where the queue came from
});

let rng = Math.random;
export const setRandomSource = (fn) => {
  rng = fn || Math.random;
};

const prep = (tracks) => (Array.isArray(tracks) ? tracks : [tracks]).filter(Boolean);

function startCurrent(set, get, patch = {}) {
  const s = get();
  const item = Q.currentItem({ ...s, ...patch });
  if (!item) return set({ ...patch, status: 'idle', intent: 'pause' });
  if (!item.track.isPlayable) {
    return set({ ...patch, status: 'error', intent: 'pause', error: item.track.playabilityReason || 'This track is not playable.' });
  }
  set({ ...patch, status: 'loading', intent: 'play', error: null, notice: null, playToken: s.playToken + 1 });
}

export const usePlayer = create((set, get) => ({
  ...initialPlayer(),

  current: () => Q.currentItem(get())?.track || null,

  playTracks(tracks, startIndex = 0, source = null) {
    const list = prep(tracks);
    if (!list.length) return;
    startCurrent(set, get, { ...Q.playList(list, startIndex), failures: 0, source });
  },
  playShuffled(tracks, source = null) {
    const list = prep(tracks);
    if (!list.length) return;
    const start = Math.floor(rng() * list.length);
    set({ shuffle: true });
    startCurrent(set, get, { ...Q.playList(list, start), failures: 0, source });
  },
  /** Play one track right now without discarding the current queue. */
  playNow(track) {
    if (!track) return;
    startCurrent(set, get, { ...Q.insertAndPlay(get(), track), failures: 0 });
  },
  jumpTo(qid) {
    const s = get();
    if (!s.queue.some((i) => i.qid === qid)) return;
    startCurrent(set, get, { currentQid: qid, played: s.currentQid && s.currentQid !== qid ? [...s.played, s.currentQid] : s.played, failures: 0 });
  },
  addToQueue(tracks) {
    const { startedEmpty, ...patch } = Q.enqueue(get(), prep(tracks));
    set({ ...patch, notice: null });
    return startedEmpty;
  },
  playNext(tracks) {
    const { startedEmpty, ...patch } = Q.insertNext(get(), prep(tracks));
    set(patch);
    return startedEmpty;
  },
  removeFromQueue(qid) {
    const { removedCurrent, ...patch } = Q.removeItem(get(), qid);
    if (removedCurrent) {
      if (patch.currentQid) startCurrent(set, get, patch);
      else set({ ...patch, status: 'idle', intent: 'pause' });
    } else set(patch);
  },
  reorderQueue(from, to) {
    set(Q.reorder(get(), from, to));
  },
  clearQueue() {
    set({ ...Q.clear(get(), true) });
  },

  togglePlay() {
    const s = get();
    if (!Q.currentItem(s)) return;
    if (s.status === 'error') return startCurrent(set, get);
    if (s.intent === 'play' && (s.status === 'playing' || s.status === 'loading')) set({ intent: 'pause' });
    else if (s.status === 'idle' && s.playToken === 0) startCurrent(set, get);
    else set({ intent: 'play' });
  },
  pause() {
    set({ intent: 'pause' });
  },

  /** `auto` = the track finished by itself. `listenedSec` lets the history layer count early skips. */
  next({ auto = false } = {}) {
    const s = get();
    const pick = Q.pickNext(s, { auto, rng });
    if (!pick.qid) {
      if (auto) set({ status: 'idle', intent: 'pause' });
      return false;
    }
    if (pick.replay) {
      set({ playToken: s.playToken + 1, status: 'loading', intent: 'play' });
      return true;
    }
    startCurrent(set, get, { currentQid: pick.qid, played: pick.played });
    return true;
  },
  prev(currentTime = 0) {
    const s = get();
    if (currentTime > 3 || !Q.pickPrev(s).qid) {
      if (Q.currentItem(s)) set({ playToken: s.playToken + 1, status: 'loading', intent: 'play', error: null });
      return;
    }
    const pick = Q.pickPrev(s);
    startCurrent(set, get, { currentQid: pick.qid, played: pick.played });
  },

  /** Called by the audio controller when the current track finishes. */
  handleEnded() {
    const s = get();
    const autoplay = useSettings.getState().autoplayNext;
    if (!autoplay && s.repeat !== 'one') return set({ status: 'paused', intent: 'pause' });
    get().next({ auto: true });
  },
  /** Called by the audio controller when loading or playing fails. Never leaves the UI pretending to play. */
  playbackFailed(message) {
    const s = get();
    const failures = s.failures + 1;
    const cur = Q.currentItem(s);
    set({ status: 'error', intent: 'pause', error: message, failures });
    if (failures < MAX_AUTO_SKIPS && useSettings.getState().autoplayNext && Q.pickNext(s, { auto: false, rng }).qid) {
      get().next({ auto: false });
      set((st) => ({ failures: st.failures || failures, notice: `Couldn’t play “${cur?.track.title ?? 'this track'}”. Skipped to the next track.` }));
    }
  },
  setStatus(status) {
    set(status === 'playing' ? { status, failures: 0, error: null } : { status });
  },
  needsGesture() {
    set({ status: 'paused', intent: 'pause', notice: 'Your browser blocked autoplay. Press play to start.' });
  },
  dismissNotice() {
    set({ notice: null });
  },

  setShuffle(on) {
    set({ shuffle: Boolean(on), played: [] });
  },
  toggleShuffle() {
    get().setShuffle(!get().shuffle);
  },
  cycleRepeat() {
    set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }));
  },
  setVolume(v) {
    const volume = Math.min(1, Math.max(0, Number(v) || 0));
    set({ volume, muted: volume === 0 ? true : false });
    useSettings.getState().update({ volume });
  },
  toggleMute() {
    set((s) => ({ muted: !s.muted }));
  },
  setExpanded(expanded) {
    set({ expanded: Boolean(expanded) });
  },
  setQueueOpen(queueOpen) {
    set({ queueOpen: Boolean(queueOpen) });
  },
}));

/** Count a play only when the listener actually heard enough of the track. */
export function playThresholdSeconds(durationSec) {
  const d = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 30;
  return Math.min(30, d * 0.5);
}

/** Convenience used by pages that start playback and want to remember what was played. */
export const getCurrentTrack = () => usePlayer.getState().current();
export const libraryHasFavorite = (id) => Boolean(useLibrary.getState().favoriteTracks[id]);
