'use client';
import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { useMusicParamsKey } from '@/hooks/useMusicParams';
import { useLibrary } from '@/lib/storage/libraryStore';
import { browseMusic, searchMusic } from '@/lib/client/api';
import { buildProfile, buildSections, dateKey, planQueries } from '@/lib/recommendations/engine';
import { GENRES } from '@/data/taxonomy';
import { normalizeText } from '@/lib/utilities/ids';

const findGenre = (label) => GENRES.find((g) => [g.id, g.label, g.term].some((x) => normalizeText(x) === normalizeText(label)));

export function profileFromLibrary(s = useLibrary.getState(), now = Date.now()) {
  return buildProfile({
    history: s.history,
    favorites: Object.values(s.favoriteTracks),
    followedArtists: Object.values(s.followedArtists),
    savedAlbums: Object.values(s.savedAlbums),
    playlists: s.playlists,
    skips: s.skips,
    onboarding: s.onboarding,
    now,
  });
}

/** Fetch candidate tracks from the enabled providers for each query in the plan. Fails only if every request fails. */
export async function loadPools(plan, signal) {
  const pools = { artist: {}, genre: {}, explore: [] };
  const tasks = [];
  for (const name of plan.topArtists) tasks.push(searchMusic({ q: name, types: ['tracks'], limit: 15 }, { signal }).then((r) => void (pools.artist[name] = r.tracks)));
  for (const label of plan.topGenres) {
    const g = findGenre(label);
    tasks.push(browseMusic(g ? { kind: 'genre', value: g.id, limit: 20 } : { kind: 'term', value: label, limit: 20 }, { signal }).then((r) => void (pools.genre[label] = r.tracks)));
  }
  for (const g of plan.exploreGenres) tasks.push(browseMusic({ kind: 'genre', value: g.id, limit: 15 }, { signal }).then((r) => void pools.explore.push(...r.tracks)));
  const results = await Promise.allSettled(tasks);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const failed = results.filter((r) => r.status === 'rejected');
  if (tasks.length && failed.length === tasks.length) throw failed[0].reason;
  return pools;
}

/** Personalised sections for Home. Only fetches once there is a real signal (history, favorites, follows or onboarding picks). */
export function useRecommendations() {
  const history = useLibrary((s) => s.history);
  const favoriteTracks = useLibrary((s) => s.favoriteTracks);
  const followedArtists = useLibrary((s) => s.followedArtists);
  const savedAlbums = useLibrary((s) => s.savedAlbums);
  const playlists = useLibrary((s) => s.playlists);
  const onboarding = useLibrary((s) => s.onboarding);
  const hydrated = useLibrary((s) => s.hydrated);
  const providersKey = useMusicParamsKey();

  const profile = useMemo(
    () => profileFromLibrary({ history, favoriteTracks, followedArtists, savedAlbums, playlists, skips: {}, onboarding }),
    [history, favoriteTracks, followedArtists, savedAlbums, playlists, onboarding],
  );
  const plan = useMemo(() => planQueries(profile, { allGenres: GENRES }), [profile]);
  const planKey = JSON.stringify([plan.topArtists, plan.topGenres, plan.exploreGenres.map((g) => g.id), providersKey, dateKey()]);

  const state = useAsync(
    async (signal) => {
      const pools = await loadPools(plan, signal);
      const lib = useLibrary.getState();
      const p = profileFromLibrary(lib);
      const sections = buildSections({
        profile: p,
        pools,
        library: { history: lib.history, favorites: Object.values(lib.favoriteTracks) },
        recentRecs: lib.recentRecs,
      });
      lib.noteRecommended(sections.recommendedForYou.slice(0, 10).map((s) => s.track.id));
      return sections;
    },
    [planKey],
    { enabled: hydrated && profile.hasSignal },
  );
  return { profile, hasSignal: profile.hasSignal, hydrated, sections: state.data, loading: state.loading, error: state.error, retry: state.retry };
}
