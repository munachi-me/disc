'use client';
import { useParams } from 'next/navigation';
import { ExternalLink, UserCheck, UserPlus } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { AlbumCard, ArtistCard, Shelf } from '@/components/music/Cards';
import { ProviderBadge } from '@/components/music/Badges';
import { TrackList } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { ErrorState, RowSkeletons } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { fetchArtist } from '@/lib/client/api';
import { useLibrary } from '@/lib/storage/libraryStore';
import { toast } from '@/lib/toastStore';

export default function ArtistPage() {
  const id = decodeURIComponent(useParams().id || '');
  const { data, error, loading, retry } = useAsync((signal) => fetchArtist(id, { signal }), [id]);
  const following = useLibrary((s) => Boolean(s.followedArtists[id]));
  const toggleFollow = useLibrary((s) => s.toggleFollowArtist);
  if (loading && !data) return <div className="page"><RowSkeletons count={8} /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={retry} title="Couldn’t load this artist" /></div>;
  const { artist, tracks = [], albums = [], related = [] } = data;
  const source = { type: 'artist', id: artist.id, name: artist.name };
  return (
    <div className="page">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Artwork src={artist.artworkUrl} alt={`Photo of ${artist.name}`} seed={artist.id} className="w-40 shrink-0 sm:w-52" rounded="rounded-full" size={56} />
        <div className="min-w-0">
          <p className="text-sm text-muted">Artist</p>
          <h1 className="page-title mt-1 break-words">{artist.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted"><ProviderBadge provider={artist.provider} />{artist.genres?.length > 0 && artist.genres.join(', ')}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <PlayActions tracks={tracks} source={source} />
        <button type="button" className="btn-secondary" aria-pressed={following} onClick={() => toast(toggleFollow(artist) ? `Following ${artist.name}` : `Unfollowed ${artist.name}`)}>
          {following ? <UserCheck size={16} /> : <UserPlus size={16} />} {following ? 'Following' : 'Follow'}
        </button>
        {artist.externalUrl && <a className="btn-ghost" href={artist.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open source page</a>}
      </div>
      {artist.bio ? <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{artist.bio}</p> : <p className="mt-6 text-sm text-muted">This source doesn’t provide a biography.</p>}
      {tracks.length > 0 && <Shelf title="Tracks" subtitle="As ordered by the source."><TrackList tracks={tracks.slice(0, 20)} source={source} /></Shelf>}
      {albums.length > 0 && <Shelf title="Albums and singles"><div className="scroll-x">{albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div></Shelf>}
      {related.length > 0 && <Shelf title="Related artists"><div className="scroll-x">{related.map((a) => <ArtistCard key={a.id} artist={a} />)}</div></Shelf>}
    </div>
  );
}
