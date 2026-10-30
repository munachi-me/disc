import { artistKey, dedupeKey, normalizeText } from '@/lib/utilities/ids';

/**
 * DISC recommendation engine — a transparent, rule-based scorer. It is NOT machine learning.
 * See README ("Recommendation algorithm") for the full description.
 *
 * Everything here is pure (no network, no storage, no clock unless passed in) so it is easy to test.
 */

const DAY = 86_400_000;

export const DEFAULT_OPTIONS = {
  halfLifeDays: 21, // a play loses half its influence every 21 days
  maxPerArtist: 2, // diversity cap per result list
  minPlaysForSignal: 3,
  weights: {
    artist: 3, // candidate's artist is one you play a lot
    genre: 2, // candidate's genre is one you play a lot
    favoriteGenre: 1, // shares a genre with a favorited track
    followedArtist: 1.5, // artist is followed or has a favorited track
    novelty: 0.5, // you haven't played this exact track yet
    repeatPenalty: 0.7, // per time it was already shown in recommendations
    skipPenalty: 0.8, // per early skip of this exact track
    seedArtist: 3, // (similar tracks) same artist as the seed
    seedGenre: 2, // (similar tracks) per shared genre with the seed
  },
};

export function recencyWeight(timestamp, now = Date.now(), halfLifeDays = DEFAULT_OPTIONS.halfLifeDays) {
  const age = Math.max(0, (now - (Number(timestamp) || 0)) / DAY);
  return Math.pow(0.5, age / halfLifeDays);
}

const genreKey = (g) => normalizeText(g);
const primaryArtist = (t) => artistKey(t?.artists?.[0]);

function bump(map, key, weight, label) {
  if (!key || !(weight > 0)) return;
  const cur = map.get(key);
  if (cur) cur.weight += weight;
  else map.set(key, { label, weight });
}

/**
 * Turn the user's library and history into a weighted taste profile.
 * @param {{history?: Array, favorites?: Array, followedArtists?: Array, savedAlbums?: Array, playlists?: Array, skips?: Object, onboarding?: Object, now?: number, options?: Object}} input
 *   favorites/followedArtists/savedAlbums are arrays of { item, addedAt }.
 */
export function buildProfile({ history = [], favorites = [], followedArtists = [], savedAlbums = [], playlists = [], skips = {}, onboarding = {}, now = Date.now(), options = {} } = {}) {
  const opt = { ...DEFAULT_OPTIONS, ...options, weights: { ...DEFAULT_OPTIONS.weights, ...(options.weights || {}) } };
  const artists = new Map();
  const genres = new Map();
  const playedIds = new Set();
  const lastPlayed = new Map();
  const favoriteIds = new Set();
  const favoriteGenres = new Set();
  const affinityArtists = new Set(); // followed, or has a favorited track

  const addTrack = (t, w) => {
    for (const a of t.artists || []) bump(artists, artistKey(a), w, a.name);
    for (const g of t.genres || []) bump(genres, genreKey(g), w, g);
  };

  for (const h of history) {
    if (!h?.track) continue;
    playedIds.add(h.track.id);
    lastPlayed.set(h.track.id, Math.max(lastPlayed.get(h.track.id) || 0, h.playedAt || 0));
    addTrack(h.track, recencyWeight(h.playedAt, now, opt.halfLifeDays) * (h.completed ? 1 : 0.6));
  }
  for (const f of favorites) {
    if (!f?.item) continue;
    favoriteIds.add(f.item.id);
    addTrack(f.item, 2 * recencyWeight(f.addedAt, now, opt.halfLifeDays) + 0.5);
    (f.item.genres || []).forEach((g) => favoriteGenres.add(genreKey(g)));
    (f.item.artists || []).forEach((a) => affinityArtists.add(artistKey(a)));
  }
  for (const f of followedArtists) {
    if (!f?.item) continue;
    bump(artists, artistKey(f.item.name), 3, f.item.name);
    affinityArtists.add(artistKey(f.item.name));
    (f.item.genres || []).forEach((g) => bump(genres, genreKey(g), 1, g));
  }
  for (const f of savedAlbums) {
    for (const a of f?.item?.artists || []) bump(artists, artistKey(a), 1.5, a.name);
    for (const g of f?.item?.genres || []) bump(genres, genreKey(g), 1, g);
  }
  for (const p of playlists) for (const x of p.tracks || []) if (x?.track) addTrack(x.track, 0.4); // membership, no decay
  for (const g of onboarding.genres || []) bump(genres, genreKey(g), 2, g);
  for (const a of onboarding.artists || []) {
    bump(artists, artistKey(a), 2, a);
    affinityArtists.add(artistKey(a));
  }

  const max = (m) => Math.max(0, ...[...m.values()].map((v) => v.weight));
  const onboardingPicks = (onboarding.genres?.length || 0) + (onboarding.artists?.length || 0);
  return {
    artists,
    genres,
    maxArtist: max(artists),
    maxGenre: max(genres),
    playedIds,
    lastPlayed,
    favoriteIds,
    favoriteGenres,
    affinityArtists,
    skips,
    playCount: history.length,
    hasSignal: history.length >= opt.minPlaysForSignal || favorites.length > 0 || followedArtists.length > 0 || onboardingPicks > 0,
    options: opt,
    now,
  };
}

export const topEntries = (map, n = 5) =>
  [...map.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, n)
    .map((v) => v.label);

/** Score one candidate. Returns { score, reasons }. Higher is better. */
export function scoreCandidate(track, profile, { mode = 'match', recentRecs = {} } = {}) {
  const w = profile.options.weights;
  const reasons = [];
  let artistScore = 0;
  let topArtist = null;
  for (const a of track.artists || []) {
    const entry = profile.artists.get(artistKey(a));
    const n = entry && profile.maxArtist ? entry.weight / profile.maxArtist : 0;
    if (n > artistScore) {
      artistScore = n;
      topArtist = entry.label;
    }
  }
  let genreScore = 0;
  let topGenre = null;
  for (const g of track.genres || []) {
    const entry = profile.genres.get(genreKey(g));
    const n = entry && profile.maxGenre ? entry.weight / profile.maxGenre : 0;
    if (n > genreScore) {
      genreScore = n;
      topGenre = entry.label;
    }
  }

  let score;
  if (mode === 'explore') {
    // Prefer tracks whose genre and artist are *less* familiar.
    score = 2 * (1 - genreScore) + (1 - artistScore) + (profile.playedIds.has(track.id) ? 0 : w.novelty);
    if (track.genres?.length) reasons.push(`Outside your usual: ${track.genres[0]}`);
    else reasons.push('Something different');
  } else {
    score = w.artist * artistScore + w.genre * genreScore;
    if (topArtist && artistScore > 0) reasons.push(`You listen to ${topArtist}`);
    if (topGenre && genreScore > 0) reasons.push(`You like ${topGenre}`);
    if ((track.genres || []).some((g) => profile.favoriteGenres.has(genreKey(g)))) {
      score += w.favoriteGenre;
      reasons.push('Similar to your favorites');
    }
    if ((track.artists || []).some((a) => profile.affinityArtists.has(artistKey(a)))) score += w.followedArtist;
    if (!profile.playedIds.has(track.id)) score += w.novelty;
  }
  score -= (recentRecs[track.id] || 0) * w.repeatPenalty;
  score -= (profile.skips?.[track.id] || 0) * w.skipPenalty;
  return { score, reasons };
}

/**
 * Rank candidates: drop duplicates / unplayable / excluded, score, sort, then enforce artist diversity.
 */
export function rankTracks(candidates, profile, { limit = 20, maxPerArtist = profile.options.maxPerArtist, excludeIds = new Set(), recentRecs = {}, mode = 'match' } = {}) {
  const seenId = new Set();
  const seenKey = new Set();
  const scored = [];
  for (const t of candidates) {
    if (!t || !t.isPlayable || excludeIds.has(t.id) || seenId.has(t.id)) continue;
    const key = dedupeKey(t);
    if (seenKey.has(key)) continue; // same recording from another provider
    seenId.add(t.id);
    seenKey.add(key);
    scored.push({ track: t, ...scoreCandidate(t, profile, { mode, recentRecs }) });
  }
  scored.sort((a, b) => b.score - a.score || (a.track.id < b.track.id ? -1 : 1));
  const perArtist = new Map();
  const out = [];
  for (const s of scored) {
    const k = primaryArtist(s.track);
    const n = perArtist.get(k) || 0;
    if (n >= maxPerArtist) continue;
    perArtist.set(k, n + 1);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Tracks similar to a seed: same artist and shared genres weigh most, profile fit breaks ties. */
export function similarTracks(seed, candidates, profile, { limit = 12, recentRecs = {} } = {}) {
  const w = profile.options.weights;
  const seedArtists = new Set((seed.artists || []).map(artistKey));
  const seedGenres = new Set((seed.genres || []).map(genreKey));
  const seenKey = new Set([dedupeKey(seed)]);
  const scored = [];
  for (const t of candidates) {
    if (!t?.isPlayable || t.id === seed.id) continue;
    const key = dedupeKey(t);
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    const sharedArtist = (t.artists || []).some((a) => seedArtists.has(artistKey(a)));
    const sharedGenres = (t.genres || []).filter((g) => seedGenres.has(genreKey(g))).length;
    if (!sharedArtist && !sharedGenres) continue;
    const base = scoreCandidate(t, profile, { recentRecs });
    const reasons = [];
    if (sharedArtist) reasons.push(`Same artist as ${seed.title}`);
    if (sharedGenres) reasons.push(`Shares genre with ${seed.title}`);
    scored.push({ track: t, score: (sharedArtist ? w.seedArtist : 0) + sharedGenres * w.seedGenre + base.score * 0.5, reasons });
  }
  scored.sort((a, b) => b.score - a.score || (a.track.id < b.track.id ? -1 : 1));
  const perArtist = new Map();
  return scored.filter((s) => {
    const k = primaryArtist(s.track);
    const n = perArtist.get(k) || 0;
    if (n >= profile.options.maxPerArtist) return false;
    perArtist.set(k, n + 1);
    return true;
  }).slice(0, limit);
}

/** Deterministic shuffle (mulberry32) so "Your Daily Mix" is stable within a day but changes tomorrow. */
export function seededShuffle(list, seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const dateKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** What to ask the providers for, given the profile. Pure; the hook performs the requests. */
export function planQueries(profile, { allGenres = [], now = Date.now() } = {}) {
  const topArtists = topEntries(profile.artists, 3);
  const topGenres = topEntries(profile.genres, 3);
  const topKeys = new Set(topGenres.map(genreKey));
  const unfamiliar = allGenres.filter((g) => !topKeys.has(genreKey(g.label)) && !topKeys.has(genreKey(g.term)));
  const exploreGenres = seededShuffle(unfamiliar, dateKey(now)).slice(0, 2);
  return { topArtists, topGenres, exploreGenres };
}

/**
 * Build every recommendation section from candidate pools.
 * @param {Object} pools { artist: {name: Track[]}, genre: {name: Track[]}, explore: Track[] }
 */
export function buildSections({ profile, pools, library = {}, recentRecs = {}, now = Date.now() }) {
  const flat = (obj) => Object.values(obj || {}).flat();
  const matchPool = [...flat(pools.artist), ...flat(pools.genre)];
  const owned = new Set([...profile.favoriteIds]);

  const recommendedForYou = rankTracks(matchPool, profile, { limit: 20, recentRecs });

  // Because you played …: the most recent distinct played track that has candidates
  let because = null;
  const seenSeeds = new Set();
  for (const h of library.history || []) {
    if (!h?.track || seenSeeds.has(h.track.id)) continue;
    seenSeeds.add(h.track.id);
    const items = similarTracks(h.track, matchPool, profile, { limit: 12, recentRecs });
    if (items.length >= 3) {
      because = { seed: h.track, items };
      break;
    }
    if (seenSeeds.size >= 5) break;
  }

  // Similar artists: artists of ranked candidates that the user doesn't follow / favorite yet
  const artistStats = new Map();
  for (const s of rankTracks(matchPool, profile, { limit: 60, maxPerArtist: 3, recentRecs })) {
    const a = s.track.artists?.[0];
    const key = artistKey(a);
    if (!key || profile.affinityArtists.has(key) || profile.artists.has(key)) continue;
    const cur = artistStats.get(key) || { name: a.name, id: a.id || null, provider: s.track.provider, artworkUrl: s.track.artworkUrl, genres: s.track.genres, total: 0, n: 0 };
    cur.total += s.score;
    cur.n += 1;
    artistStats.set(key, cur);
  }
  const similarArtists = [...artistStats.values()].sort((a, b) => b.total / b.n - a.total / a.n || a.name.localeCompare(b.name)).slice(0, 12);

  // Daily mix: stable for the day. Mostly matches, with a few "explore" picks mixed in.
  const mixMatches = rankTracks(matchPool, profile, { limit: 30, maxPerArtist: 3, recentRecs }).map((s) => s.track);
  const mixExplore = rankTracks(pools.explore || [], profile, { limit: 6, mode: 'explore', recentRecs }).map((s) => s.track);
  const dailyMix = seededShuffle([...mixMatches.slice(0, 24), ...mixExplore.slice(0, 5)], dateKey(now));

  const explore = rankTracks(pools.explore || [], profile, { limit: 16, mode: 'explore', recentRecs, excludeIds: owned });

  // Rediscover: favorites and played tracks you haven't heard for a while (library only, no network)
  const rediscoverPool = new Map();
  for (const f of library.favorites || []) rediscoverPool.set(f.item.id, f.item);
  for (const h of library.history || []) if (h?.track && !rediscoverPool.has(h.track.id)) rediscoverPool.set(h.track.id, h.track);
  const rediscover = [...rediscoverPool.values()]
    .filter((t) => t.isPlayable)
    .map((t) => ({ track: t, last: profile.lastPlayed.get(t.id) || 0 }))
    .filter((x) => now - x.last > 14 * DAY)
    .sort((a, b) => a.last - b.last || (a.track.id < b.track.id ? -1 : 1))
    .slice(0, 16)
    .map((x) => ({ track: x.track, score: 0, reasons: [x.last ? 'Not played in a while' : 'Favorited, never played'] }));

  return { recommendedForYou, because, similarArtists, dailyMix, explore, rediscover };
}

/** Most played artists/tracks/genres over a window — used for "Your Most Played Artists" and the stats page. */
export function summarizeListening(history, { now = Date.now(), days = 30 } = {}) {
  const since = days ? now - days * DAY : 0;
  const rows = history.filter((h) => h.playedAt >= since);
  const tally = (keyFn, labelFn) => {
    const m = new Map();
    for (const h of rows) {
      for (const k of keyFn(h)) {
        const cur = m.get(k) || { key: k, label: labelFn(h, k), plays: 0, seconds: 0 };
        cur.plays += 1;
        cur.seconds += h.listenedSec || 0;
        m.set(k, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.plays - a.plays || b.seconds - a.seconds || a.label.localeCompare(b.label));
  };
  return {
    plays: rows.length,
    totalSeconds: rows.reduce((n, h) => n + (h.listenedSec || 0), 0),
    artists: tally((h) => [artistKey(h.track.artists?.[0])].filter(Boolean), (h) => h.track.artists[0].name),
    tracks: tally((h) => [h.track.id], (h) => h.track.title).map((t) => ({ ...t, track: rows.find((h) => h.track.id === t.key)?.track })),
    genres: tally((h) => (h.track.genres || []).slice(0, 2).map(genreKey).filter(Boolean), (h, k) => (h.track.genres || []).find((g) => genreKey(g) === k) || k),
  };
}

/** Plays per day for the last `days` days (oldest first). */
export function activityByDay(history, { now = Date.now(), days = 14 } = {}) {
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) buckets.set(dateKey(now - i * DAY), { date: dateKey(now - i * DAY), plays: 0, seconds: 0 });
  for (const h of history) {
    const b = buckets.get(dateKey(h.playedAt));
    if (b) {
      b.plays += 1;
      b.seconds += h.listenedSec || 0;
    }
  }
  return [...buckets.values()];
}
