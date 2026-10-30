'use client';
import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { usePlayer, useProgress } from '@/lib/player/playerStore';
import { seekTo } from '@/lib/player/audioEngine';
import { formatDuration } from '@/lib/utilities/format';

export function PlayPauseButton({ size = 'md' }) {
  const status = usePlayer((s) => s.status);
  const intent = usePlayer((s) => s.intent);
  const hasTrack = usePlayer((s) => Boolean(s.currentQid));
  const toggle = usePlayer((s) => s.togglePlay);
  const playing = status === 'playing' && intent === 'play';
  const loading = status === 'loading' && intent === 'play';
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-11 w-11';
  return (
    <button type="button" onClick={toggle} disabled={!hasTrack} aria-label={playing || loading ? 'Pause' : status === 'error' ? 'Retry playback' : 'Play'} className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-fg text-black transition hover:scale-105 disabled:opacity-40`}>
      {loading ? <Loader2 className="animate-spin" size={size === 'lg' ? 28 : 20} /> : playing ? <Pause size={size === 'lg' ? 28 : 20} fill="currentColor" /> : <Play size={size === 'lg' ? 28 : 20} fill="currentColor" className="translate-x-px" />}
    </button>
  );
}

export function TransportControls({ size = 'md' }) {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { toggleShuffle, cycleRepeat, next, prev } = usePlayer.getState();
  const hasTrack = usePlayer((s) => Boolean(s.currentQid));
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = repeat === 'off' ? 'Repeat: off' : repeat === 'all' ? 'Repeat: all' : 'Repeat: one';
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3">
      <button type="button" className="icon-btn" aria-pressed={shuffle} aria-label={shuffle ? 'Shuffle: on' : 'Shuffle: off'} onClick={toggleShuffle}>
        <Shuffle size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label="Previous track" disabled={!hasTrack} onClick={() => prev(useProgress.getState().currentTime)}>
        <SkipBack size={20} fill="currentColor" />
      </button>
      <PlayPauseButton size={size} />
      <button type="button" className="icon-btn" aria-label="Next track" disabled={!hasTrack} onClick={() => next()}>
        <SkipForward size={20} fill="currentColor" />
      </button>
      <button type="button" className="icon-btn" aria-pressed={repeat !== 'off'} aria-label={repeatLabel} onClick={cycleRepeat}>
        <RepeatIcon size={18} />
      </button>
    </div>
  );
}

export function SeekBar({ fallbackDuration = 0, compact = false }) {
  const currentTime = useProgress((s) => s.currentTime);
  const mediaDuration = useProgress((s) => s.duration);
  const hasTrack = usePlayer((s) => Boolean(s.currentQid));
  const duration = mediaDuration || fallbackDuration || 0;
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-muted">
      {!compact && <span className="w-9 text-right">{formatDuration(currentTime)}</span>}
      <input
        type="range"
        className="disc-range"
        min={0}
        max={duration || 1}
        step={0.5}
        value={Math.min(currentTime, duration || 1)}
        disabled={!hasTrack || !duration}
        aria-label="Seek"
        aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => seekTo(Number(e.target.value))}
      />
      {!compact && <span className="w-9">{formatDuration(duration)}</span>}
    </div>
  );
}

export function VolumeControl({ className = '' }) {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const { setVolume, toggleMute } = usePlayer.getState();
  const shown = muted ? 0 : volume;
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button type="button" className="icon-btn" aria-pressed={muted || volume === 0} aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'} onClick={() => (volume === 0 ? setVolume(0.5) : toggleMute())}>
        {shown === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input type="range" className="disc-range w-24" min={0} max={1} step={0.01} value={shown} aria-label="Volume" style={{ '--pct': `${shown * 100}%` }} onChange={(e) => setVolume(Number(e.target.value))} />
    </div>
  );
}

/** One-line, honest playback status. */
export function statusLine({ status, error, track }) {
  if (!track) return '';
  if (status === 'error') return error || 'Playback failed.';
  if (status === 'loading') return 'Loading…';
  if (track.playbackType === 'preview') return 'Preview clip · not the full track';
  return track.provider === 'local' ? 'Imported file' : 'Full track';
}
