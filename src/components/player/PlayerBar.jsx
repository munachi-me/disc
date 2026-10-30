'use client';
import { ChevronUp, ListMusic, ListPlus, Music2 } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { ArtistLinks } from '@/components/music/ArtistLinks';
import { FavoriteButton } from '@/components/music/TrackRow';
import { PlayPauseButton, SeekBar, TransportControls, VolumeControl, statusLine } from './Controls';
import { usePlayer, useProgress } from '@/lib/player/playerStore';
import { useDialogs } from '@/lib/dialogStore';
import { SkipForward } from 'lucide-react';

export function PlayerBar() {
  const track = usePlayer((s) => s.queue.find((i) => i.qid === s.currentQid)?.track || null);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const notice = usePlayer((s) => s.notice);
  const { setExpanded, setQueueOpen, dismissNotice, next } = usePlayer.getState();
  const openAdd = useDialogs((s) => s.openAddToPlaylist);
  const line = statusLine({ status, error, track });
  const isError = status === 'error';

  if (!track) {
    return (
      <div className="hidden h-[84px] shrink-0 items-center gap-3 border-t border-line bg-sidebar px-5 text-sm text-muted md:flex">
        <Music2 size={18} aria-hidden="true" /> Nothing playing. Pick a track to start listening.
      </div>
    );
  }

  return (
    <section aria-label="Player" className="relative shrink-0 border-t border-line bg-sidebar">
      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 bg-elevated px-4 py-1.5 text-xs text-muted">
          <span>{notice}</span>
          <button type="button" className="underline" onClick={dismissNotice}>Dismiss</button>
        </div>
      )}
      {/* Mobile mini-player */}
      <div className="md:hidden">
        <MiniProgress />
        <div className="flex items-center gap-1 px-2 py-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left" onClick={() => setExpanded(true)} aria-label={`Open full player. Now playing ${track.title}`}>
            <Artwork src={track.artworkUrl} alt="" seed={track.id} className="h-11 w-11 shrink-0" rounded="rounded-md" size={16} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{track.title}</span>
              <span className={`block truncate text-xs ${isError ? 'text-red-300' : 'text-muted'}`}>{isError ? line : track.artists.map((a) => a.name).join(', ')}</span>
            </span>
          </button>
          <PlayPauseButton size="sm" />
          <button type="button" className="icon-btn" aria-label="Next track" onClick={() => next()}><SkipForward size={20} fill="currentColor" /></button>
        </div>
      </div>
      {/* Desktop bar */}
      <div className="hidden h-[84px] grid-cols-[1fr_minmax(320px,2fr)_1fr] items-center gap-4 px-4 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setExpanded(true)} aria-label="Open full player" className="shrink-0 rounded-md">
            <Artwork src={track.artworkUrl} alt="" seed={track.id} className="h-14 w-14" rounded="rounded-md" size={18} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{track.title}</p>
            <p className="truncate text-xs text-muted"><ArtistLinks artists={track.artists} /></p>
            <p className={`truncate text-[11px] ${isError ? 'text-red-300' : 'text-muted'}`} role={isError ? 'alert' : 'status'}>{line}</p>
          </div>
          <FavoriteButton track={track} />
          <button type="button" className="icon-btn" aria-label="Add to playlist" onClick={() => openAdd([track])}><ListPlus size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <TransportControls />
          <SeekBar fallbackDuration={track.playbackType === 'preview' ? 30 : track.duration || 0} />
        </div>
        <div className="flex items-center justify-end gap-1">
          <button type="button" className="icon-btn" aria-label="Open queue" onClick={() => setQueueOpen(true)}><ListMusic size={18} /></button>
          <VolumeControl />
          <button type="button" className="icon-btn" aria-label="Open full player" onClick={() => setExpanded(true)}><ChevronUp size={18} /></button>
        </div>
      </div>
    </section>
  );
}

function MiniProgress() {
  const t = useProgress((s) => s.currentTime);
  const d = useProgress((s) => s.duration);
  return (
    <div className="h-0.5 w-full bg-line" aria-hidden="true">
      <div className="h-full bg-accent" style={{ width: `${d ? Math.min(100, (t / d) * 100) : 0}%` }} />
    </div>
  );
}
