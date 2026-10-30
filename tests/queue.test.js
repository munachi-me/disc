import { describe, expect, it } from 'vitest';
import * as Q from '@/lib/player/queue';
import { makeList, makeTrack } from './helpers';

const state = (tracks, over = {}) => {
  const { queue, currentQid } = Q.playList(tracks, 0);
  return { queue, currentQid, played: [], shuffle: false, repeat: 'off', ...over };
};
const titles = (s) => s.queue.map((i) => i.track.id);

describe('queue operations', () => {
  it('plays a list from a start index', () => {
    const l = makeList(3);
    const s = Q.playList(l, 1);
    expect(s.queue).toHaveLength(3);
    expect(Q.currentItem(s).track.id).toBe(l[1].id);
  });
  it('adds to the end, plays next, and removes', () => {
    const [a, b, c, d] = makeList(4);
    let s = state([a, b]);
    s = { ...s, ...Q.enqueue(s, [c]) };
    expect(titles(s)).toEqual([a.id, b.id, c.id]);
    s = { ...s, ...Q.insertNext(s, [d]) };
    expect(titles(s)).toEqual([a.id, d.id, b.id, c.id]);
    const removed = Q.removeItem(s, s.queue[2].qid);
    expect(removed.queue.map((i) => i.track.id)).toEqual([a.id, d.id, c.id]);
  });
  it('removing the current item moves to the item that slid into its slot', () => {
    const l = makeList(3);
    const s = state(l);
    const r = Q.removeItem(s, s.currentQid);
    expect(r.removedCurrent).toBe(true);
    expect(r.queue.find((i) => i.qid === r.currentQid).track.id).toBe(l[1].id);
  });
  it('reorders without mutating the input and ignores bad indexes', () => {
    const l = makeList(3);
    const s = state(l);
    const before = titles(s);
    const r = Q.reorder(s, 0, 2);
    expect(r.queue.map((i) => i.track.id)).toEqual([l[1].id, l[2].id, l[0].id]);
    expect(titles(s)).toEqual(before);
    expect(Q.reorder(s, 0, 9)).toEqual({});
  });
  it('clear keeps the current item', () => {
    const s = state(makeList(3));
    const c = Q.clear(s, true);
    expect(c.queue).toHaveLength(1);
    expect(c.currentQid).toBe(s.currentQid);
    expect(Q.clear(s, false).queue).toHaveLength(0);
  });
});

describe('next / previous / repeat / shuffle', () => {
  it('moves forward and stops at the end with repeat off', () => {
    const s = state(makeList(2));
    const n = Q.pickNext(s);
    expect(n.qid).toBe(s.queue[1].qid);
    expect(Q.pickNext({ ...s, currentQid: s.queue[1].qid }).qid).toBeNull();
  });
  it('repeat all wraps around', () => {
    const s = state(makeList(2), { repeat: 'all' });
    expect(Q.pickNext({ ...s, currentQid: s.queue[1].qid }).qid).toBe(s.queue[0].qid);
  });
  it('repeat one replays on auto-end but a manual next moves on', () => {
    const s = state(makeList(2), { repeat: 'one' });
    expect(Q.pickNext(s, { auto: true }).replay).toBe(true);
    expect(Q.pickNext(s, { auto: false }).qid).toBe(s.queue[1].qid);
  });
  it('skips unplayable tracks', () => {
    const dead = makeTrack({ streamUrl: null, previewUrl: null });
    const [a, c] = makeList(2);
    const s = state([a, dead, c]);
    expect(dead.isPlayable).toBe(false);
    expect(Q.pickNext(s).qid).toBe(s.queue[2].qid);
  });
  it('previous goes back one item', () => {
    const s = state(makeList(3));
    const at1 = { ...s, currentQid: s.queue[1].qid };
    expect(Q.pickPrev(at1).qid).toBe(s.queue[0].qid);
    expect(Q.pickPrev(s).qid).toBeNull();
  });
  it('shuffle visits every track once, never repeats, and leaves queue order untouched', () => {
    const l = makeList(6);
    let s = state(l, { shuffle: true });
    const order = titles(s);
    const seen = [s.currentQid];
    let rng = 0.31;
    for (let i = 0; i < 5; i++) {
      rng = (rng * 7.7) % 1;
      const p = Q.pickNext(s, { rng: () => rng });
      expect(p.qid).toBeTruthy();
      expect(seen).not.toContain(p.qid);
      seen.push(p.qid);
      s = { ...s, currentQid: p.qid, played: p.played };
    }
    expect(new Set(seen).size).toBe(6);
    expect(Q.pickNext(s).qid).toBeNull();
    expect(titles(s)).toEqual(order);
  });
  it('shuffle previous walks back through what was played', () => {
    const s = state(makeList(4), { shuffle: true });
    const p = Q.pickNext(s, { rng: () => 0.5 });
    const s2 = { ...s, currentQid: p.qid, played: p.played };
    expect(Q.pickPrev(s2).qid).toBe(s.currentQid);
  });
});
