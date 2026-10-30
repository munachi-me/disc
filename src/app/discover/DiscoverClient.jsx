'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Dices } from 'lucide-react';
import { Shelf, ArtistCard } from '@/components/music/Cards';
import { TrackShelf } from '@/components/music/Shelves';
import { TrackList } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { EmptyState, ErrorState, ProviderErrors, RowSkeletons } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useMusicParamsKey } from '@/hooks/useMusicParams';
import { browseMusic } from '@/lib/client/api';
import { ACTIVITIES, GENRES, MOODS, MOOD_BY_ID, REGIONS, browseParams } from '@/data/taxonomy';
import { dateKey, seededShuffle } from '@/lib/recommendations/engine';
import { useRecommendations } from '@/hooks/useRecommendations';

const KINDS = ['genre', 'mood', 'region', 'term'];

function Category({ kind, value, offset = 0 }) {
  const recipe = browseParams(kind, value);
  const key = useMusicParamsKey();
  const { data, error, loading, retry } = useAsync((signal) => browseMusic({ kind, value, offset, limit: 40 }, { signal }), [kind, value, offset, key], { enabled: Boolean(recipe) });
  if (!recipe) return <EmptyState title="Unknown category">That category doesn’t exist. Pick one from Discover.</EmptyState>;
  return (
    <div>
      <h1 className="page-title mb-1">{recipe.label}</h1>
      <p className="mb-4 text-sm text-muted">Live results from your enabled music sources, matched to this {kind === 'term' ? 'search' : kind}. Not a chart or ranking.</p>
      {loading && !data ? <RowSkeletons count={8} /> : error ? <ErrorState error={error} onRetry={retry} /> : (
        <>
          <ProviderErrors errors={data.errors} onRetry={retry} />
          {data.tracks.length ? (
            <>
              <div className="mb-3"><PlayActions tracks={data.tracks} source={{ type: 'discover', name: recipe.label }} savePlaylist /></div>
              <TrackList tracks={data.tracks} source={{ type: 'discover', name: recipe.label }} />
            </>
          ) : <EmptyState title="No tracks found">Try another category, or check Settings → Music sources.</EmptyState>}
        </>
      )}
    </div>
  );
}

export function DiscoverClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const kind = sp.get('kind');
  const value = sp.get('value');
  const offset = Number(sp.get('offset')) || 0;
  const { sections } = useRecommendations();
  const day = dateKey();
  const hiddenGem = useMemo(() => seededShuffle(GENRES, `gem-${day}`)[0], [day]);
  const hiddenOffset = useMemo(() => 90 + seededShuffle([0, 10, 20, 30, 40, 50], `off-${day}`)[0], [day]);

  const surprise = () => {
    const g = GENRES[Math.floor(Math.random() * GENRES.length)];
    const o = Math.floor(Math.random() * 6) * 10;
    router.push(`/discover?kind=genre&value=${g.id}&offset=${o}`);
  };

  if (kind && KINDS.includes(kind) && value) {
    return (
      <div className="page">
        <Link href="/discover" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft size={16} /> All categories</Link>
        <Category kind={kind} value={value} offset={offset} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Discover</h1>
        <button type="button" className="btn-primary" onClick={surprise}><Dices size={16} /> Surprise me</button>
      </div>

      <Shelf title="Moods" subtitle="Each mood is turned into tag and keyword searches for your music sources.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MOODS.map((m) => (
            <Link key={m.id} href={`/discover?kind=mood&value=${m.id}`} className="rounded-card border border-line bg-card p-4 transition-colors hover:border-accent/60 hover:bg-elevated">
              <p className="font-medium">{m.label}</p>
              <p className="mt-0.5 text-xs text-muted">{m.blurb}</p>
            </Link>
          ))}
        </div>
      </Shelf>

      <Shelf title="Activities">
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => <Link key={a.id} href={`/discover?kind=mood&value=${a.mood}`} className="chip" title={`Uses the ${MOOD_BY_ID[a.mood].label} mood`}>{a.label}</Link>)}
        </div>
      </Shelf>

      <Shelf title="Genres">
        <div className="flex flex-wrap gap-2">{GENRES.map((g) => <Link key={g.id} href={`/discover?kind=genre&value=${g.id}`} className="chip">{g.label}</Link>)}</div>
      </Shelf>

      <Shelf title="Music from around the world" subtitle="Keyword searches by region and style.">
        <div className="flex flex-wrap gap-2">{REGIONS.map((r) => <Link key={r.id} href={`/discover?kind=region&value=${r.id}`} className="chip">{r.label}</Link>)}</div>
      </Shelf>

      <TrackShelf title="Popular this week" subtitle="Jamendo’s weekly popularity ranking." kind="term" value="music" order="popularity_week" only={['jamendo']} />
      <TrackShelf title="Recently released" subtitle="Newest uploads on Jamendo." kind="term" value="music" order="releasedate_desc" only={['jamendo']} />
      <TrackShelf title={`Hidden gems: ${hiddenGem.label}`} subtitle="Taken from deeper in Jamendo’s weekly ranking, past the usual top results." kind="genre" value={hiddenGem.id} order="popularity_week" offset={hiddenOffset} only={['jamendo']} />

      {sections?.similarArtists?.length > 0 && (
        <Shelf title="Similar artists" subtitle="Based on what you play and favorite.">
          <div className="scroll-x">{sections.similarArtists.map((a) => <ArtistCard key={a.id || a.name} artist={a} />)}</div>
        </Shelf>
      )}

      <Shelf title="Curated collections" subtitle="Generated from keyword searches, not hand-edited playlists. Save any result as your own playlist.">
        <div className="flex flex-wrap gap-2">
          {[['Late night jazz', 'late night jazz'], ['Public-domain classical', 'classical piano'], ['Netlabel electronica', 'netlabel electronic'], ['Acoustic evenings', 'acoustic evening']].map(([label, v]) => (
            <Link key={label} href={`/discover?kind=term&value=${encodeURIComponent(v)}`} className="chip">{label}</Link>
          ))}
        </div>
      </Shelf>
    </div>
  );
}
