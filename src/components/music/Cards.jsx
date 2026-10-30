'use client';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Artwork } from './Artwork';
import { ArtistLinks } from './ArtistLinks';
import { PlaybackBadge } from './Badges';
import { usePlayer } from '@/lib/player/playerStore';
import { albumHref, artistHref, playlistHref } from '@/lib/links';
import { toast } from '@/lib/toastStore';

function PlayOverlay({ onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 [@media(pointer:coarse)]:translate-y-0 [@media(pointer:coarse)]:opacity-100"
    >
      <Play size={18} fill="currentColor" />
    </button>
  );
}

/** Track as a square card. `tracks` + `index` let it start the surrounding shelf as a queue. */
export function TrackCard({ track, tracks, index = 0, source, reason }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const play = () => (track.isPlayable ? playTracks(tracks || [track], tracks ? index : 0, source) : toast(track.playabilityReason || 'Not playable', { tone: 'error' }));
  return (
    <div className="group w-36 md:w-44">
      <div className="relative">
        <Artwork src={track.artworkUrl} alt="" seed={track.id} className="w-full" />
        <PlayOverlay onClick={play} label={`Play ${track.title}`} />
      </div>
      <p className="mt-2.5 truncate text-sm font-medium">{track.title}</p>
      <p className="truncate text-xs text-muted">
        <ArtistLinks artists={track.artists} />
      </p>
      <div className="mt-1 truncate text-[11px] text-muted">{reason ? reason : <PlaybackBadge track={track} compact />}</div>
    </div>
  );
}

export function AlbumCard({ album }) {
  return (
    <Link href={albumHref(album.id)} className="group block w-36 md:w-44">
      <Artwork src={album.artworkUrl} alt="" seed={album.id} className="w-full" />
      <p className="mt-2.5 truncate text-sm font-medium group-hover:underline">{album.title}</p>
      <p className="truncate text-xs text-muted">{[album.artists?.[0]?.name, album.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ') || 'Album'}</p>
    </Link>
  );
}

export function ArtistCard({ artist }) {
  return (
    <Link href={artistHref(artist)} className="group block w-32 text-center md:w-40">
      <Artwork src={artist.artworkUrl} alt="" seed={artist.id || artist.name} className="w-full" rounded="rounded-full" size={32} />
      <p className="mt-2.5 truncate text-sm font-medium group-hover:underline">{artist.name}</p>
      <p className="truncate text-xs text-muted">Artist</p>
    </Link>
  );
}

export function PlaylistCard({ playlist }) {
  const cover = playlist.coverUrl || playlist.tracks.find((t) => t.track.artworkUrl)?.track.artworkUrl;
  return (
    <Link href={playlistHref(playlist.id)} className="group block w-36 md:w-44">
      <Artwork src={cover} alt="" seed={playlist.id} className="w-full" />
      <p className="mt-2.5 truncate text-sm font-medium group-hover:underline">{playlist.name}</p>
      <p className="truncate text-xs text-muted">
        {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
        {playlist.generated ? ' · Auto-generated' : ''}
      </p>
    </Link>
  );
}

export function Shelf({ title, subtitle, action, children }) {
  return (
    <section className="mt-8 first:mt-0" aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="section-title truncate">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
