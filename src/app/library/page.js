'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Disc3, HardDrive, Library as LibraryIcon, ListMusic, Trash2, Users } from 'lucide-react';
import { AlbumCard, ArtistCard, PlaylistCard, Shelf, TrackCard } from '@/components/music/Cards';
import { TrackList } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { LocalImport } from '@/components/music/LocalImport';
import { FilterBar } from '@/components/ui/Controls';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, RowSkeletons } from '@/components/ui/States';
import { useHydrated } from '@/hooks/useHydrated';
import { useLibrary } from '@/lib/storage/libraryStore';
import { useDialogs } from '@/lib/dialogStore';
import { estimateStorage } from '@/lib/storage/idb';
import { filterEntries, sortEntries } from '@/lib/utilities/sort';
import { toast } from '@/lib/toastStore';

const TABS = [['tracks', 'Songs', LibraryIcon], ['albums', 'Albums', Disc3], ['artists', 'Artists', Users], ['playlists', 'Playlists', ListMusic], ['imported', 'On this device', HardDrive]];

export default function LibraryPage() {
  const hydrated = useHydrated();
  const lib = useLibrary();
  const openCreate = useDialogs((s) => s.openCreatePlaylist);
  const [tab, setTab] = useState('tracks');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('added');
  const [confirmClear, setConfirmClear] = useState(false);
  const [storage, setStorage] = useState(null);
  useEffect(() => {
    estimateStorage().then(setStorage).catch(() => {});
  }, [lib.localTracks.length]);

  const favs = useMemo(() => sortEntries(filterEntries(Object.values(lib.favoriteTracks), q), sort), [lib.favoriteTracks, q, sort]);
  const albums = useMemo(() => sortEntries(filterEntries(Object.values(lib.savedAlbums), q), sort), [lib.savedAlbums, q, sort]);
  const artists = useMemo(() => sortEntries(filterEntries(Object.values(lib.followedArtists), q), sort === 'artist' ? 'title' : sort), [lib.followedArtists, q, sort]);
  const playlists = useMemo(() => {
    const list = lib.playlists.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
    return [...list].sort((a, b) => (sort === 'title' ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt));
  }, [lib.playlists, q, sort]);
  const local = useMemo(() => sortEntries(filterEntries(lib.localTracks.map((t) => ({ item: t, addedAt: 0 })), q), sort === 'added' ? 'title' : sort).map((e) => e.item), [lib.localTracks, q, sort]);
  const recent = useMemo(() => {
    const seen = new Set();
    return lib.history.filter((h) => (seen.has(h.track.id) ? false : seen.add(h.track.id))).slice(0, 12).map((h) => h.track);
  }, [lib.history]);
  const total = Object.keys(lib.favoriteTracks).length + Object.keys(lib.savedAlbums).length + Object.keys(lib.followedArtists).length + lib.playlists.length + lib.localTracks.length;

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Your Library</h1>
        <button type="button" className="btn-ghost" disabled={!total} onClick={() => setConfirmClear(true)}><Trash2 size={16} /> Clear library</button>
      </div>
      <p className="mt-1 text-sm text-muted">Everything here is stored in this browser on this device. It isn’t synced to a cloud account.</p>

      {!hydrated ? <div className="mt-6"><RowSkeletons /></div> : (
        <>
          {recent.length > 0 && (
            <Shelf title="Recently played" action={<Link href="/history" className="text-sm text-muted hover:text-fg">History</Link>}>
              <div className="scroll-x">{recent.map((t, i) => <TrackCard key={t.id} track={t} tracks={recent} index={i} source={{ type: 'history', name: 'Recently played' }} />)}</div>
            </Shelf>
          )}
          <div role="tablist" aria-label="Library sections" className="mb-4 mt-8 flex gap-2 overflow-x-auto pb-1">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className="chip shrink-0"><Icon size={14} aria-hidden="true" /> {label}</button>
            ))}
          </div>
          <FilterBar query={q} onQuery={setQ} sort={sort} onSort={setSort} label="Search your library" />
          <div className="mt-5">
            {tab === 'tracks' && (favs.length ? (<><div className="mb-3"><PlayActions tracks={favs.map((e) => e.item)} source={{ type: 'favorites', name: 'Favorites' }} /></div><TrackList tracks={favs.map((e) => e.item)} source={{ type: 'favorites', name: 'Favorites' }} /></>) : <EmptyState icon={LibraryIcon} title={q ? 'No matches' : 'No saved songs'}>{q ? 'Try a different search.' : 'Favorite a track and it appears here, newest first.'}</EmptyState>)}
            {tab === 'albums' && (albums.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{albums.map((e) => <AlbumCard key={e.item.id} album={e.item} />)}</div> : <EmptyState icon={Disc3} title={q ? 'No matches' : 'No saved albums'}>Open an album and choose Save to keep it here.</EmptyState>)}
            {tab === 'artists' && (artists.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{artists.map((e) => <ArtistCard key={e.item.id} artist={e.item} />)}</div> : <EmptyState icon={Users} title={q ? 'No matches' : 'Not following anyone'}>Follow artists from their page and they’ll appear here.</EmptyState>)}
            {tab === 'playlists' && (
              <>
                <button type="button" className="btn-primary mb-4" onClick={() => openCreate([])}>New playlist</button>
                {playlists.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</div> : <EmptyState icon={ListMusic} title={q ? 'No matches' : 'No playlists yet'}>Create one, or save a Discover result as a playlist.</EmptyState>}
              </>
            )}
            {tab === 'imported' && (
              <>
                <LocalImport />
                {storage && <p className="mt-3 text-xs text-muted">Browser storage in use: {(storage.usage / 1048576).toFixed(1)} MB{storage.quota ? ` of about ${(storage.quota / 1048576).toFixed(0)} MB available` : ''}.</p>}
                <div className="mt-5">{local.length ? <TrackList tracks={local} source={{ type: 'local', name: 'On this device' }} showAlbum /> : <EmptyState icon={HardDrive} title="No imported files">Import audio you own to play it here without any music provider.</EmptyState>}</div>
              </>
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          lib.clearLibrary();
          setConfirmClear(false);
          toast('Library cleared');
        }}
        title="Clear your whole library?"
        message="This removes favorites, saved albums, followed artists, playlists, listening history and imported track records from this browser. Imported audio files stay in browser storage until you use Settings → Clear all local data. This can’t be undone."
        confirmLabel="Clear library"
      />
    </div>
  );
}
