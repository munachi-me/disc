'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { TrackList } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { FilterBar } from '@/components/ui/Controls';
import { EmptyState, RowSkeletons } from '@/components/ui/States';
import { useHydrated } from '@/hooks/useHydrated';
import { useLibrary } from '@/lib/storage/libraryStore';
import { filterEntries, sortEntries } from '@/lib/utilities/sort';

export default function FavoritesPage() {
  const hydrated = useHydrated();
  const favorites = useLibrary((s) => s.favoriteTracks);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('added');
  const entries = useMemo(() => sortEntries(filterEntries(Object.values(favorites), q), sort), [favorites, q, sort]);
  const tracks = entries.map((e) => e.item);
  return (
    <div className="page">
      <h1 className="page-title">Favorites</h1>
      <p className="mt-1 text-sm text-muted">Saved in this browser only. They aren’t synced to other devices.</p>
      {!hydrated ? <div className="mt-6"><RowSkeletons /></div> : Object.keys(favorites).length === 0 ? (
        <div className="mt-6"><EmptyState icon={Heart} title="No favorites yet" action={<Link href="/discover" className="btn-primary">Discover music</Link>}>Tap the heart on any track to keep it here.</EmptyState></div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            <PlayActions tracks={tracks} source={{ type: 'favorites', name: 'Favorites' }} savePlaylist />
            <FilterBar query={q} onQuery={setQ} sort={sort} onSort={setSort} label="Search favorites" />
          </div>
          <div className="mt-4">{tracks.length ? <TrackList tracks={tracks} source={{ type: 'favorites', name: 'Favorites' }} /> : <p className="py-8 text-center text-sm text-muted">No favorites match “{q}”.</p>}</div>
        </>
      )}
    </div>
  );
}
