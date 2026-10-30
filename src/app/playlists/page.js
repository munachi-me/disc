'use client';
import { useMemo } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import { PlaylistCard, Shelf } from '@/components/music/Cards';
import { EmptyState, RowSkeletons } from '@/components/ui/States';
import { useHydrated } from '@/hooks/useHydrated';
import { useLibrary } from '@/lib/storage/libraryStore';
import { useDialogs } from '@/lib/dialogStore';

export default function PlaylistsPage() {
  const hydrated = useHydrated();
  const playlists = useLibrary((s) => s.playlists);
  const openCreate = useDialogs((s) => s.openCreatePlaylist);
  const { mine, generated } = useMemo(() => {
    const sorted = [...playlists].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
    return { mine: sorted.filter((p) => !p.generated), generated: sorted.filter((p) => p.generated) };
  }, [playlists]);
  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Playlists</h1>
        <button type="button" className="btn-primary" onClick={() => openCreate([])}><Plus size={16} /> New playlist</button>
      </div>
      <p className="mt-1 text-sm text-muted">No account needed. Playlists are stored in this browser and keep each track’s original source.</p>
      <div className="mt-6">
        {!hydrated ? <RowSkeletons /> : playlists.length === 0 ? (
          <EmptyState icon={ListMusic} title="No playlists yet" action={<button type="button" className="btn-primary" onClick={() => openCreate([])}>Create your first playlist</button>}>Add tracks from any track menu, or save a Discover category as a playlist.</EmptyState>
        ) : (
          <>
            {mine.length > 0 && <Shelf title="Your playlists"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{mine.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</div></Shelf>}
            {generated.length > 0 && <Shelf title="Auto-generated" subtitle="Created from search or discovery results, not hand-curated."><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{generated.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</div></Shelf>}
          </>
        )}
      </div>
    </div>
  );
}
