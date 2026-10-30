'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Copy, Heart, ListMusic, Pencil, Trash2 } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { TrackRow } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { EditPlaylistDialog } from '@/components/playlists/EditPlaylistDialog';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, RowSkeletons } from '@/components/ui/States';
import { useHydrated } from '@/hooks/useHydrated';
import { useLibrary } from '@/lib/storage/libraryStore';
import { usePlayer } from '@/lib/player/playerStore';
import { formatTotalTime, pluralize } from '@/lib/utilities/format';
import { playlistHref } from '@/lib/links';
import { toast } from '@/lib/toastStore';

export default function PlaylistPage() {
  const { id: raw } = useParams();
  const id = decodeURIComponent(raw || '');
  const router = useRouter();
  const hydrated = useHydrated();
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id));
  const { moveTrackInPlaylist, duplicatePlaylist, deletePlaylist, togglePlaylistFavorite } = useLibrary.getState();
  const playTracks = usePlayer((s) => s.playTracks);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!hydrated) return <div className="page"><RowSkeletons /></div>;
  if (!playlist)
    return (
      <div className="page">
        <EmptyState icon={ListMusic} title="Playlist not found" action={<Link href="/playlists" className="btn-primary">Back to playlists</Link>}>It may have been deleted, or it lives in a different browser.</EmptyState>
      </div>
    );

  const tracks = playlist.tracks.map((x) => x.track);
  const cover = playlist.coverUrl || tracks.find((t) => t.artworkUrl)?.artworkUrl;
  const seconds = tracks.reduce((n, t) => n + (t.playbackType === 'full' && t.duration ? t.duration : 0), 0);
  const source = { type: 'playlist', id: playlist.id, name: playlist.name };

  return (
    <div className="page">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Artwork src={cover} alt="" seed={playlist.id} className="w-40 shrink-0 sm:w-52" size={56} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{playlist.generated ? 'Auto-generated playlist' : 'Playlist'}</p>
          <h1 className="page-title mt-1 break-words">{playlist.name}</h1>
          {playlist.description && <p className="mt-2 max-w-xl text-sm text-muted">{playlist.description}</p>}
          <p className="mt-2 text-sm text-muted">{tracks.length} {pluralize(tracks.length, 'track')}{seconds ? ` · ${formatTotalTime(seconds)} of full tracks` : ''}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <PlayActions tracks={tracks} source={source} />
        <button type="button" className="icon-btn" aria-pressed={playlist.favorite} aria-label={playlist.favorite ? 'Unmark favorite playlist' : 'Mark as favorite playlist'} onClick={() => togglePlaylistFavorite(id)}><Heart size={18} fill={playlist.favorite ? 'currentColor' : 'none'} /></button>
        <button type="button" className="icon-btn" aria-label="Edit playlist" onClick={() => setEditing(true)}><Pencil size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Duplicate playlist" onClick={() => { const nid = duplicatePlaylist(id); if (nid) { toast('Playlist duplicated'); router.push(playlistHref(nid)); } }}><Copy size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Delete playlist" onClick={() => setDeleting(true)}><Trash2 size={18} /></button>
      </div>

      <div className="mt-6">
        {tracks.length === 0 ? (
          <EmptyState icon={ListMusic} title="This playlist is empty" action={<Link href="/search" className="btn-primary">Find music</Link>}>Use “Add to playlist” in any track’s menu or the player.</EmptyState>
        ) : (
          <div role="list" className="space-y-0.5">
            {playlist.tracks.map((x, i) => (
              <div role="listitem" key={x.pid}>
                <TrackRow
                  track={x.track}
                  index={i}
                  menuExtra={{ playlistId: id, pid: x.pid }}
                  onPlay={() => (x.track.isPlayable ? playTracks(tracks, i, source) : toast(x.track.playabilityReason || 'This track is unavailable.', { tone: 'error' }))}
                  dragHandle={
                    <div className="flex flex-col">
                      <button type="button" className="icon-btn !h-5 !w-6" aria-label={`Move ${x.track.title} up`} disabled={i === 0} onClick={() => moveTrackInPlaylist(id, i, i - 1)}><ChevronUp size={14} /></button>
                      <button type="button" className="icon-btn !h-5 !w-6" aria-label={`Move ${x.track.title} down`} disabled={i === tracks.length - 1} onClick={() => moveTrackInPlaylist(id, i, i + 1)}><ChevronDown size={14} /></button>
                    </div>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <EditPlaylistDialog playlist={playlist} open={editing} onClose={() => setEditing(false)} />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title={`Delete “${playlist.name}”?`} message="The playlist is removed from this browser. The tracks themselves are not affected. This can’t be undone." confirmLabel="Delete playlist" onConfirm={() => { deletePlaylist(id); toast('Playlist deleted'); router.push('/playlists'); }} />
    </div>
  );
}
