'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Play, RotateCw, Search } from 'lucide-react';
import { Shelf, TrackCard, ArtistCard } from '@/components/music/Cards';
import { TrackCardShelf, TrackShelf } from '@/components/music/Shelves';
import { SourcesCard } from '@/components/music/SourcesCard';
import { Onboarding } from '@/components/music/Onboarding';
import { Artwork } from '@/components/music/Artwork';
import { CardSkeletons, ErrorState } from '@/components/ui/States';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useLibrary } from '@/lib/storage/libraryStore';
import { usePlayer } from '@/lib/player/playerStore';
import { GENRES, MOODS } from '@/data/taxonomy';
import { dateKey, seededShuffle, summarizeListening } from '@/lib/recommendations/engine';
import { greetingForHour } from '@/lib/utilities/format';
import { toast } from '@/lib/toastStore';
import { artistKey } from '@/lib/utilities/ids';

function uniqueRecent(history, n = 12) {
  const seen = new Set();
  const out = [];
  for (const h of history) {
    if (seen.has(h.track.id)) continue;
    seen.add(h.track.id);
    out.push(h.track);
    if (out.length >= n) break;
  }
  return out;
}

export default function HomePage() {
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => setGreeting(greetingForHour(new Date().getHours())), []);
  const history = useLibrary((s) => s.history);
  const hydrated = useLibrary((s) => s.hydrated);
  const onboarding = useLibrary((s) => s.onboarding);
  const favoriteCount = useLibrary((s) => Object.keys(s.favoriteTracks).length);
  const playTracks = usePlayer((s) => s.playTracks);
  const { hasSignal, sections, loading, error, retry } = useRecommendations();

  const recent = useMemo(() => uniqueRecent(history), [history]);
  const topArtists = useMemo(() => summarizeListening(history, { days: 30 }).artists.slice(0, 10), [history]);
  const topArtistRefs = useMemo(() => {
    const byKey = new Map();
    for (const h of history) {
      const a = h.track.artists[0];
      if (a && !byKey.has(artistKey(a))) byKey.set(artistKey(a), a);
    }
    return topArtists.map((t) => byKey.get(t.key)).filter(Boolean);
  }, [topArtists, history]);
  const discoverGenre = useMemo(() => seededShuffle(GENRES, `home-${dateKey()}`)[0], []);
  const last = history[0]?.track;
  const showOnboarding = hydrated && !onboarding.done && history.length === 0 && favoriteCount === 0;

  return (
    <div className="page space-y-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{greeting}</h1>
        <Link href="/search" className="flex w-full items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-sm text-muted hover:border-accent/60 sm:w-72">
          <Search size={16} aria-hidden="true" /> Search songs, artists, albums <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[11px] sm:inline">/</kbd>
        </Link>
      </div>

      {showOnboarding && <div className="mb-6"><Onboarding /></div>}
      {hydrated && !hasSignal && <div className="mb-6"><SourcesCard /></div>}

      {last && (
        <Shelf title="Continue listening">
          <div className="flex items-center gap-4 rounded-card bg-card p-3">
            <Artwork src={last.artworkUrl} alt="" seed={last.id} className="h-16 w-16 shrink-0" rounded="rounded-lg" size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{last.title}</p>
              <p className="truncate text-sm text-muted">{last.artists.map((a) => a.name).join(', ')}</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => (last.isPlayable ? playTracks([last], 0, { type: 'history', name: 'Continue listening' }) : toast(last.playabilityReason || 'Not playable', { tone: 'error' }))}>
              <Play size={16} fill="currentColor" /> Resume
            </button>
          </div>
        </Shelf>
      )}

      {recent.length > 0 && (
        <Shelf title="Recently played" action={<Link href="/history" className="text-sm text-muted hover:text-fg">See all</Link>}>
          <div className="scroll-x">{recent.map((t, i) => <TrackCard key={t.id} track={t} tracks={recent} index={i} source={{ type: 'history', name: 'Recently played' }} />)}</div>
        </Shelf>
      )}

      {hasSignal && (
        <>
          {loading && !sections && <Shelf title="Made for you" subtitle="Finding tracks that match what you play…"><CardSkeletons /></Shelf>}
          {error && !sections && <div className="mt-8"><ErrorState error={error} onRetry={retry} title="Couldn’t build your recommendations" /></div>}
          {sections && (
            <>
              <TrackCardShelf title="Made for you" subtitle="Ranked from your listening, favorites and follows. Each card says why." items={sections.recommendedForYou.slice(0, 16)} source={{ type: 'recs', name: 'Made for you' }} />
              <TrackCardShelf
                title="Your Daily Mix"
                subtitle="Refreshes each day. Mostly matches, with a few tracks outside your usual taste."
                items={sections.dailyMix}
                source={{ type: 'recs', name: 'Your Daily Mix' }}
                action={sections.dailyMix.length > 0 && <button type="button" className="btn-secondary !py-1.5" onClick={() => playTracks(sections.dailyMix, 0, { type: 'recs', name: 'Your Daily Mix' })}><Play size={14} fill="currentColor" /> Play mix</button>}
              />
              {sections.because && <TrackCardShelf title={`Because you listened to ${sections.because.seed.title}`} items={sections.because.items} source={{ type: 'recs', name: 'Because you listened' }} />}
              {sections.similarArtists.length > 0 && (
                <Shelf title="Artists like your favorites">
                  <div className="scroll-x">{sections.similarArtists.map((a) => <ArtistCard key={a.id || a.name} artist={a} />)}</div>
                </Shelf>
              )}
              <TrackCardShelf title="Rediscover your library" subtitle="Saved or played, but not heard for a while." items={sections.rediscover} source={{ type: 'recs', name: 'Rediscover' }} />
              <TrackCardShelf title="Explore beyond your usual taste" subtitle="Genres you haven’t played much." items={sections.explore} source={{ type: 'recs', name: 'Explore' }} />
            </>
          )}
          {topArtistRefs.length > 0 && (
            <Shelf title="Your most played artists" subtitle="From the last 30 days of plays in this browser.">
              <div className="scroll-x">{topArtistRefs.map((a) => <ArtistCard key={a.id || a.name} artist={a} />)}</div>
            </Shelf>
          )}
        </>
      )}

      <TrackShelf title="Popular this week" subtitle="Jamendo’s weekly popularity ranking." kind="term" value="music" order="popularity_week" only={['jamendo']} />
      <TrackShelf title="New releases" subtitle="Latest uploads on Jamendo." kind="term" value="music" order="releasedate_desc" only={['jamendo']} />

      <Shelf title="Music by mood">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => <Link key={m.id} href={`/discover?kind=mood&value=${m.id}`} className="chip">{m.label}</Link>)}
        </div>
      </Shelf>
      <Shelf title="Music by genre">
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => <Link key={g.id} href={`/discover?kind=genre&value=${g.id}`} className="chip">{g.label}</Link>)}
        </div>
      </Shelf>

      <TrackShelf
        title={`Discover something new: ${discoverGenre.label}`}
        subtitle="Today’s pick from the genre list."
        kind="genre"
        value={discoverGenre.id}
        action={<Link href="/discover" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><RotateCw size={14} aria-hidden="true" /> More in Discover</Link>}
      />
    </div>
  );
}
