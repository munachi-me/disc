'use client';
import { useParams } from 'next/navigation';
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { ArtistLinks } from '@/components/music/ArtistLinks';
import { ProviderBadge } from '@/components/music/Badges';
import { TrackList } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { EmptyState, ErrorState, RowSkeletons } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { fetchAlbum } from '@/lib/client/api';
import { useLibrary } from '@/lib/storage/libraryStore';
import { formatReleaseDate, formatTotalTime, pluralize } from '@/lib/utilities/format';
import { toast } from '@/lib/toastStore';

export default function AlbumPage() {
  const id = decodeURIComponent(useParams().id || '');
  const { data, error, loading, retry } = useAsync((signal) => fetchAlbum(id, { signal }), [id]);
  const saved = useLibrary((s) => Boolean(s.savedAlbums[id]));
  const toggleSave = useLibrary((s) => s.toggleSaveAlbum);
  if (loading && !data) return <div className="page"><RowSkeletons count={8} /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={retry} title="Couldn’t load this album" /></div>;
  const { album, tracks = [] } = data;
  const full = tracks.reduce((n, t) => n + (t.playbackType === 'full' && t.duration ? t.duration : 0), 0);
  const source = { type: 'album', id: album.id, name: album.title };
  const date = formatReleaseDate(album.releaseDate);
  return (
    <div className="page">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Artwork src={album.artworkUrl} alt={`Cover of ${album.title}`} seed={album.id} className="w-44 shrink-0 sm:w-56" size={56} />
        <div className="min-w-0">
          <p className="text-sm text-muted">Album</p>
          <h1 className="page-title mt-1 break-words">{album.title}</h1>
          <p className="mt-2 text-sm"><ArtistLinks artists={album.artists} /></p>
          <p className="mt-1 text-sm text-muted">{[date, `${tracks.length} ${pluralize(tracks.length, 'track')}`, full ? formatTotalTime(full) : null].filter(Boolean).join(' · ')} <ProviderBadge provider={album.provider} /></p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <PlayActions tracks={tracks} source={source} />
        <button type="button" className="btn-secondary" aria-pressed={saved} onClick={() => toast(toggleSave(album) ? 'Album saved to library' : 'Album removed')}>
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? 'Saved' : 'Save album'}
        </button>
        {album.externalUrl && <a className="btn-ghost" href={album.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open source page</a>}
      </div>
      <div className="mt-6">{tracks.length ? <TrackList tracks={tracks} source={source} showAlbum={false} /> : <EmptyState title="No track listing available">This source didn’t return tracks for the album.</EmptyState>}</div>
      <p className="mt-8 text-xs text-muted">{album.attribution}{album.license ? ` · License: ${album.license}` : ''}</p>
    </div>
  );
}
