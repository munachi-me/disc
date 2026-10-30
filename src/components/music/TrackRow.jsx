'use client';
import Link from 'next/link';
import { memo } from 'react';
import { Heart, MoreHorizontal, Pause, Play } from 'lucide-react';
import { Artwork } from './Artwork';
import { ArtistLinks } from './ArtistLinks';
import { ExplicitTag, PlaybackBadge, ProviderBadge } from './Badges';
import { usePlayer } from '@/lib/player/playerStore';
import { useLibrary } from '@/lib/storage/libraryStore';
import { useDialogs } from '@/lib/dialogStore';
import { albumHref } from '@/lib/links';
import { formatDuration } from '@/lib/utilities/format';
import { toast } from '@/lib/toastStore';

export function FavoriteButton({ track, className = '' }) {
  const fav = useLibrary((s) => Boolean(s.favoriteTracks[track.id]));
  const toggle = useLibrary((s) => s.toggleFavorite);
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-pressed={fav}
      aria-label={fav ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
      onClick={() => {
        const now = toggle(track);
        toast(now ? 'Added to favorites' : 'Removed from favorites');
      }}
    >
      <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

/**
 * One track in a list. `onPlay` starts playback of the surrounding list at this track.
 * Pass `menuExtra` ({playlistId, pid}) so the menu can offer "Remove from playlist".
 */
export const TrackRow = memo(function TrackRow({ track, index, onPlay, menuExtra, showAlbum = true, showIndex = true, dragHandle = null }) {
  const isCurrent = usePlayer((s) => s.queue.find((i) => i.qid === s.currentQid)?.track.id === track.id);
  const playing = usePlayer((s) => s.status === 'playing' && s.intent === 'play');
  const loading = usePlayer((s) => s.status === 'loading');
  const togglePlay = usePlayer((s) => s.togglePlay);
  const openMenu = useDialogs((s) => s.openTrackMenu);
  const active = isCurrent && (playing || loading);
  const handlePlay = () => (isCurrent ? togglePlay() : onPlay?.());

  return (
    <div className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-card ${isCurrent ? 'bg-card' : ''} ${track.isPlayable ? '' : 'opacity-70'}`}>
      {dragHandle}
      {showIndex && (
        <span className="hidden w-6 shrink-0 text-center text-sm tabular-nums text-muted md:block" aria-hidden="true">
          {index + 1}
        </span>
      )}
      <button type="button" onClick={handlePlay} className="relative shrink-0 rounded-md" aria-label={`${active && playing ? 'Pause' : 'Play'} ${track.title} by ${track.artists.map((a) => a.name).join(', ')}${track.playbackType === 'preview' ? ' (preview)' : track.playbackType === 'none' ? ' (unavailable)' : ''}`}>
        <Artwork src={track.artworkUrl} alt="" seed={track.id} className="h-11 w-11 md:h-12 md:w-12" rounded="rounded-md" size={16} />
        <span className={`absolute inset-0 flex items-center justify-center rounded-md bg-black/55 text-white transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
          {active && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isCurrent ? 'text-accent-bright' : ''}`}>
          {track.title}
          {track.explicit && <ExplicitTag />}
        </p>
        <p className="flex items-center gap-2 truncate text-xs text-muted">
          <ArtistLinks artists={track.artists} className="truncate" />
          <span className="hidden shrink-0 sm:inline-flex">
            <PlaybackBadge track={track} compact />
          </span>
        </p>
      </div>
      {showAlbum && track.album && (
        <div className="hidden w-1/4 min-w-0 lg:block">
          {track.album.id ? (
            <Link href={albumHref(track.album.id)} className="block truncate text-sm text-muted hover:text-fg hover:underline">
              {track.album.title}
            </Link>
          ) : (
            <span className="block truncate text-sm text-muted">{track.album.title}</span>
          )}
        </div>
      )}
      <span className="hidden shrink-0 md:block">
        <ProviderBadge provider={track.provider} />
      </span>
      <FavoriteButton track={track} className="hidden sm:inline-flex" />
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">{track.duration && track.playbackType !== 'preview' ? formatDuration(track.duration) : track.playbackType === 'preview' ? '0:30' : '—'}</span>
      <button type="button" className="icon-btn" aria-label={`More actions for ${track.title}`} aria-haspopup="dialog" onClick={() => openMenu(track, menuExtra)}>
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
});

export function TrackList({ tracks, source = null, menuExtraFor, showAlbum = true, showIndex = true }) {
  const playTracks = usePlayer((s) => s.playTracks);
  return (
    <div role="list" className="space-y-0.5">
      {tracks.map((t, i) => (
        <div role="listitem" key={`${t.id}-${i}`}>
          <TrackRow
            track={t}
            index={i}
            showAlbum={showAlbum}
            showIndex={showIndex}
            menuExtra={menuExtraFor?.(t, i)}
            onPlay={() => {
              if (!t.isPlayable) return toast(t.playabilityReason || 'This track is not playable.', { tone: 'error' });
              playTracks(tracks, i, source);
            }}
          />
        </div>
      ))}
    </div>
  );
}
