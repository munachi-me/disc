import { randomId } from '@/lib/utilities/ids';

/**
 * Pure queue logic. State shape: { queue: [{qid, track}], currentQid, shuffle, repeat: 'off'|'one'|'all', played: qid[] }.
 * Every function returns a partial state; nothing mutates its input. The source playlist is never touched:
 * the queue holds copies, and "shuffle" only changes the order in which the queue is visited.
 */

export const makeItem = (track) => ({ qid: randomId('q'), track });
export const isPlayableTrack = (t) => Boolean(t?.isPlayable);
const indexOfQid = (queue, qid) => queue.findIndex((i) => i.qid === qid);
export const currentItem = (s) => s.queue.find((i) => i.qid === s.currentQid) || null;

export function playList(tracks, startIndex = 0) {
  const queue = tracks.map(makeItem);
  const start = queue[Math.min(Math.max(startIndex, 0), Math.max(queue.length - 1, 0))];
  return { queue, currentQid: start?.qid ?? null, played: [] };
}

export function enqueue(state, tracks) {
  const items = tracks.map(makeItem);
  const queue = [...state.queue, ...items];
  return { queue, currentQid: state.currentQid ?? items[0]?.qid ?? null, startedEmpty: state.queue.length === 0 };
}

export function insertNext(state, tracks) {
  const items = tracks.map(makeItem);
  const at = state.currentQid ? indexOfQid(state.queue, state.currentQid) + 1 : 0;
  const queue = [...state.queue.slice(0, at), ...items, ...state.queue.slice(at)];
  return { queue, currentQid: state.currentQid ?? items[0]?.qid ?? null, startedEmpty: state.queue.length === 0 };
}

/** Insert a track after the current one and make it current (queue otherwise unchanged). */
export function insertAndPlay(state, track) {
  const item = makeItem(track);
  const at = state.currentQid ? indexOfQid(state.queue, state.currentQid) + 1 : state.queue.length;
  return { queue: [...state.queue.slice(0, at), item, ...state.queue.slice(at)], currentQid: item.qid, played: state.currentQid ? [...state.played, state.currentQid] : state.played };
}

export function removeItem(state, qid) {
  const idx = indexOfQid(state.queue, qid);
  if (idx === -1) return {};
  const queue = state.queue.filter((i) => i.qid !== qid);
  const played = state.played.filter((p) => p !== qid);
  if (qid !== state.currentQid) return { queue, played };
  const nextItem = queue[idx] || queue[idx - 1] || null; // the item that slid into this slot, else the previous one
  return { queue, played, currentQid: nextItem?.qid ?? null, removedCurrent: true };
}

export function reorder(state, from, to) {
  const n = state.queue.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {};
  const queue = [...state.queue];
  const [m] = queue.splice(from, 1);
  queue.splice(to, 0, m);
  return { queue };
}

export function clear(state, keepCurrent = true) {
  const cur = keepCurrent ? currentItem(state) : null;
  return { queue: cur ? [cur] : [], currentQid: cur?.qid ?? null, played: [] };
}

/**
 * Decide which item plays next. `auto` = the track ended on its own (repeat-one replays it);
 * a manual "next" press always moves on. Unplayable items are skipped. Returns { qid, played } or { qid: null }.
 */
export function pickNext(state, { auto = false, rng = Math.random } = {}) {
  const { queue, currentQid, shuffle, repeat } = state;
  if (!queue.length) return { qid: null };
  if (auto && repeat === 'one' && currentQid) return { qid: currentQid, played: state.played, replay: true };
  const curIdx = indexOfQid(queue, currentQid);

  if (shuffle) {
    let visited = new Set([...state.played, currentQid]);
    let pool = queue.filter((i) => !visited.has(i.qid) && isPlayableTrack(i.track));
    let played = currentQid ? [...state.played, currentQid] : state.played;
    if (!pool.length && repeat === 'all') {
      visited = new Set([currentQid]);
      pool = queue.filter((i) => !visited.has(i.qid) && isPlayableTrack(i.track));
      played = currentQid ? [currentQid] : [];
      if (!pool.length && isPlayableTrack(currentItem(state)?.track)) pool = [currentItem(state)];
    }
    if (!pool.length) return { qid: null };
    return { qid: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].qid, played };
  }

  for (let step = 1; step <= queue.length; step++) {
    let i = curIdx + step;
    if (i >= queue.length) {
      if (repeat !== 'all') return { qid: null };
      i %= queue.length;
    }
    if (isPlayableTrack(queue[i].track)) return { qid: queue[i].qid, played: state.played };
    if (curIdx === -1 && step === queue.length) break;
  }
  return { qid: null };
}

/** Previous item. In shuffle mode this walks back through what was actually played. */
export function pickPrev(state) {
  const { queue, currentQid, shuffle, repeat, played } = state;
  if (!queue.length) return { qid: null };
  if (shuffle) {
    const stack = [...played];
    while (stack.length) {
      const qid = stack.pop();
      if (indexOfQid(queue, qid) !== -1) return { qid, played: stack };
    }
    return { qid: null };
  }
  const curIdx = indexOfQid(queue, currentQid);
  let i = curIdx - 1;
  if (i < 0) {
    if (repeat !== 'all') return { qid: null };
    i = queue.length - 1;
  }
  return { qid: queue[i].qid, played };
}
