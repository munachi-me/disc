'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Loader2, Search as SearchIcon, X } from 'lucide-react';
import { AlbumCard, ArtistCard, PlaylistCard, Shelf } from '@/components/music/Cards';
import { TrackList } from '@/components/music/TrackRow';
import { EmptyState, ErrorState, ProviderErrors, RowSkeletons } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useMusicParamsKey } from '@/hooks/useMusicParams';
import { searchMusic } from '@/lib/client/api';
import { useLibrary } from '@/lib/storage/libraryStore';
import { GENRES, MOODS, REGIONS } from '@/data/taxonomy';
import { normalizeText } from '@/lib/utilities/ids';

export const DEBOUNCE_MS = 350;
const TABS = [['all', 'All'], ['tracks', 'Songs'], ['artists', 'Artists'], ['albums', 'Albums'], ['playlists', 'Playlists']];

export function SearchClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = sp.get('q') || '';
  const [text, setText] = useState(initial);
  const [q, setQ] = useState(initial.trim());
  const [tab, setTab] = useState('all');
  const inputRef = useRef(null);
  const key = useMusicParamsKey();
  const searches = useLibrary((s) => s.searches);
  const playlists = useLibrary((s) => s.playlists);
  const followed = useLibrary((s) => s.followedArtists);
  const { addSearch, removeSearch, clearSearches } = useLibrary.getState();

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);
  useEffect(() => {
    const next = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
    if (window.location.pathname === '/search' && window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false });
  }, [q, router]);
  useEffect(() => inputRef.current?.focus(), []);

  const enabled = q.length >= 2;
  const { data, error, loading, retry } = useAsync((signal) => searchMusic({ q, limit: 12 }, { signal }), [q, key], { enabled });
  useEffect(() => {
    if (data && q.length >= 2 && (data.tracks.length || data.albums.length || data.artists.length)) addSearch(q);
  }, [data, q, addSearch]);

  const suggestions = useMemo(() => {
    const t = normalizeText(text);
    if (t.length < 2) return [];
    const kindOf = (g) => (GENRES.includes(g) ? 'genre' : MOODS.includes(g) ? 'mood' : 'region');
    const pool = [
      ...[...GENRES, ...MOODS, ...REGIONS].map((g) => ({ label: g.label, href: `/discover?kind=${kindOf(g)}&value=${g.id}`, hint: 'Browse' })),
      ...Object.values(followed).map((f) => ({ label: f.item.name, href: `/search?q=${encodeURIComponent(f.item.name)}`, hint: 'Followed artist' })),
      ...(data?.artists || []).slice(0, 4).map((a) => ({ label: a.name, href: `/search?q=${encodeURIComponent(a.name)}`, hint: 'Artist' })),
    ];
    return pool.filter((s) => normalizeText(s.label).includes(t)).slice(0, 5);
  }, [text, followed, data]);

  const matchingPlaylists = useMemo(() => (q ? playlists.filter((p) => normalizeText(p.name).includes(normalizeText(q))) : []), [playlists, q]);
  const show = (t) => tab === 'all' || tab === t;
  const hasAny = Boolean(data && (data.tracks.length || data.albums.length || data.artists.length)) || matchingPlaylists.length > 0;

  return (
    <div className="page">
      <h1 className="sr-only">Search</h1>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }} className="relative">
        <label htmlFor="search-input" className="sr-only">Search songs, artists and albums</label>
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input id="search-input" ref={inputRef} type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} autoComplete="off" placeholder="Songs, artists, albums" className="field !rounded-full !py-3 !pl-11 !pr-11" />
        {loading && enabled ? <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-label="Searching" /> : text && <button type="button" className="icon-btn absolute right-1 top-1/2 -translate-y-1/2" aria-label="Clear search" onClick={() => { setText(''); setQ(''); inputRef.current?.focus(); }}><X size={16} /></button>}
      </form>

      {suggestions.length > 0 && (!data || text.trim() !== q) && (
        <ul className="mt-2 rounded-card border border-line bg-card p-1" aria-label="Suggestions">
          {suggestions.map((s) => <li key={s.href + s.label}><Link href={s.href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-elevated">{s.label}<span className="text-xs text-muted">{s.hint}</span></Link></li>)}
        </ul>
      )}

      {!enabled && (
        <div className="mt-6">
          {searches.length > 0 ? (
            <Shelf title="Recent searches" action={<button type="button" className="text-sm text-muted hover:text-fg" onClick={clearSearches}>Clear all</button>}>
              <ul className="space-y-1">
                {searches.map((s) => (
                  <li key={s.q} className="flex items-center gap-1">
                    <button type="button" className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-card" onClick={() => { setText(s.q); setQ(s.q); }}><History size={16} className="text-muted" aria-hidden="true" /> {s.q}</button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${s.q} from recent searches`} onClick={() => removeSearch(s.q)}><X size={16} /></button>
                  </li>
                ))}
              </ul>
            </Shelf>
          ) : (
            <EmptyState icon={SearchIcon} title="Search across your music sources">Type at least two characters. Press <kbd className="rounded border border-line px-1">/</kbd> anywhere to jump here.</EmptyState>
          )}
          <div className="mt-8"><h2 className="section-title mb-3">Browse</h2><div className="flex flex-wrap gap-2">{GENRES.slice(0, 10).map((g) => <Link key={g.id} href={`/discover?kind=genre&value=${g.id}`} className="chip">{g.label}</Link>)}</div></div>
        </div>
      )}

      {enabled && (
        <div className="mt-5">
          <div role="tablist" aria-label="Result type" className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {TABS.map(([id, label]) => <button key={id} role="tab" type="button" className="chip shrink-0" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
          </div>
          {loading && !data && <RowSkeletons count={8} />}
          {error && <ErrorState error={error} onRetry={retry} title="Search failed" />}
          {data && (
            <>
              <ProviderErrors errors={data.errors} onRetry={retry} />
              {!hasAny && <EmptyState icon={SearchIcon} title={`No results for “${q}”`}>Check the spelling, try fewer words, or enable more sources in Settings.</EmptyState>}
              {show('tracks') && data.tracks.length > 0 && <Shelf title="Songs"><TrackList tracks={tab === 'all' ? data.tracks.slice(0, 8) : data.tracks} source={{ type: 'search', name: `Search: ${q}` }} /></Shelf>}
              {show('artists') && data.artists.length > 0 && <Shelf title="Artists"><div className="scroll-x">{data.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</div></Shelf>}
              {show('albums') && data.albums.length > 0 && <Shelf title="Albums"><div className="scroll-x">{data.albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div></Shelf>}
              {show('playlists') && matchingPlaylists.length > 0 && <Shelf title="Your playlists"><div className="scroll-x">{matchingPlaylists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</div></Shelf>}
              {tab === 'playlists' && !matchingPlaylists.length && <EmptyState title="No playlists match">Only your own playlists are searched. Public provider playlists aren’t available from the connected sources.</EmptyState>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
