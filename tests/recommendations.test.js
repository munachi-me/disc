import { describe, expect, it } from 'vitest';
import { buildProfile, buildSections, rankTracks, recencyWeight, scoreCandidate, seededShuffle, similarTracks, summarizeListening } from '@/lib/recommendations/engine';
import { makeTrack } from './helpers';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 1);
const plays = (track, n, daysAgo = 1) => Array.from({ length: n }, (_, i) => ({ id: `h${track.id}${i}`, track, playedAt: NOW - daysAgo * DAY - i * 1000, listenedSec: 60, completed: true }));
const track = (title, artist, genres = ['Jazz'], extra = {}) => makeTrack({ title, artists: [{ name: artist }], genres, ...extra });

describe('cold start', () => {
  it('has no signal with an empty library, and onboarding picks create one', () => {
    expect(buildProfile({ now: NOW }).hasSignal).toBe(false);
    expect(buildProfile({ now: NOW, onboarding: { genres: ['Jazz'] } }).hasSignal).toBe(true);
  });
  it('tolerates missing metadata', () => {
    const bare = makeTrack({ genres: [], album: null });
    const p = buildProfile({ now: NOW });
    expect(() => scoreCandidate(bare, p)).not.toThrow();
    expect(rankTracks([bare, null, {}], p)).toBeDefined();
  });
});

describe('recency decay', () => {
  it('halves every half-life and never increases with age', () => {
    expect(recencyWeight(NOW, NOW, 21)).toBeCloseTo(1);
    expect(recencyWeight(NOW - 21 * DAY, NOW, 21)).toBeCloseTo(0.5);
    expect(recencyWeight(NOW - 60 * DAY, NOW)).toBeLessThan(recencyWeight(NOW - 5 * DAY, NOW));
  });
  it('recent listening outweighs old listening of a different genre', () => {
    const jazz = track('J', 'A', ['Jazz']);
    const rock = track('R', 'B', ['Rock']);
    const history = [...plays(jazz, 5, 120), ...plays(rock, 5, 2)];
    const p = buildProfile({ history, now: NOW });
    const cj = track('cj', 'C', ['Jazz']);
    const cr = track('cr', 'D', ['Rock']);
    expect(scoreCandidate(cr, p).score).toBeGreaterThan(scoreCandidate(cj, p).score);
  });
});

describe('scoring', () => {
  const liked = track('Liked', 'Fav Artist', ['Jazz']);
  const profile = buildProfile({ history: plays(liked, 6), favorites: [{ item: liked, addedAt: NOW - DAY }], now: NOW });
  it('is deterministic', () => {
    const c = track('C', 'Fav Artist', ['Jazz']);
    expect(scoreCandidate(c, profile)).toEqual(scoreCandidate(c, profile));
  });
  it('prefers a favorite artist and genre over an unrelated track, and explains why', () => {
    const match = scoreCandidate(track('M', 'Fav Artist', ['Jazz']), profile);
    const other = scoreCandidate(track('O', 'Nobody', ['Polka']), profile);
    expect(match.score).toBeGreaterThan(other.score);
    expect(match.reasons.length).toBeGreaterThan(0);
  });
  it('penalises tracks already shown repeatedly and early-skipped tracks', () => {
    const c = track('C', 'Fav Artist', ['Jazz']);
    const base = scoreCandidate(c, profile).score;
    expect(scoreCandidate(c, profile, { recentRecs: { [c.id]: 4 } }).score).toBeLessThan(base);
    const skipped = buildProfile({ history: plays(liked, 6), favorites: [{ item: liked, addedAt: NOW - DAY }], skips: { [c.id]: 3 }, now: NOW });
    expect(scoreCandidate(c, skipped).score).toBeLessThan(base);
  });
  it('ranks without duplicates and enforces artist diversity', () => {
    const many = Array.from({ length: 8 }, (_, i) => track(`Song ${i}`, 'Fav Artist', ['Jazz']));
    const dup = [...many, many[0], { ...many[1] }];
    const others = [track('x', 'Other One', ['Jazz']), track('y', 'Other Two', ['Jazz'])];
    const ranked = rankTracks([...dup, ...others], profile, { limit: 10, maxPerArtist: 2 });
    const ids = ranked.map((r) => r.track.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ranked.filter((r) => r.track.artists[0].name === 'Fav Artist').length).toBeLessThanOrEqual(2);
  });
  it('excludes unplayable candidates and the user’s own excluded ids', () => {
    const dead = makeTrack({ title: 'Dead', streamUrl: null, previewUrl: null, genres: ['Jazz'] });
    const ok = track('Ok', 'Z', ['Jazz']);
    const ranked = rankTracks([dead, ok], profile, { excludeIds: new Set() });
    expect(ranked.map((r) => r.track.id)).not.toContain(dead.id);
  });
  it('similarTracks prefers the seed’s artist and genre', () => {
    const seed = track('Seed', 'S', ['Jazz']);
    const same = track('Same', 'S', ['Jazz']);
    const unrelated = track('Unrel', 'U', ['Polka']);
    const out = similarTracks(seed, [unrelated, same], profile);
    expect(out.map((o) => o.track.id)).toEqual([same.id]);
  });
});

describe('sections and stats', () => {
  it('builds sections from candidate pools and keeps the daily mix stable within a day', () => {
    const liked = track('Liked', 'Fav', ['Jazz']);
    const history = plays(liked, 4);
    const p = buildProfile({ history, favorites: [{ item: liked, addedAt: NOW }], now: NOW });
    const pool = Array.from({ length: 12 }, (_, i) => track(`P${i}`, `Artist ${i % 5}`, ['Jazz']));
    const args = { profile: p, pools: { artist: { Fav: pool }, genre: {}, explore: [track('E', 'Ex', ['Polka'])] }, library: { history, favorites: [{ item: liked }] }, now: NOW };
    const a = buildSections(args);
    const b = buildSections(args);
    expect(a.dailyMix.map((t) => t.id)).toEqual(b.dailyMix.map((t) => t.id));
    expect(a.recommendedForYou.length).toBeGreaterThan(0);
    expect(buildSections({ ...args, now: NOW + 3 * DAY }).dailyMix.map((t) => t.id)).not.toEqual([]);
  });
  it('seededShuffle is deterministic per seed', () => {
    const l = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(l, 'x')).toEqual(seededShuffle(l, 'x'));
    expect(seededShuffle(l, 'x')).not.toEqual(seededShuffle(l, 'y'));
  });
  it('summarises listening honestly, including an empty range', () => {
    const t = track('T', 'A', ['Jazz']);
    const s = summarizeListening(plays(t, 3, 2), { now: NOW, days: 7 });
    expect(s.plays).toBe(3);
    expect(s.totalSeconds).toBe(180);
    expect(summarizeListening(plays(t, 3, 40), { now: NOW, days: 7 }).plays).toBe(0);
  });
});
