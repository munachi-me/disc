'use client';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayer } from '@/lib/player/playerStore';

export function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const shown = muted ? 0 : volume;
  const Icon = shown === 0 ? VolumeX : shown < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={toggleMute}>
        <Icon size={18} />
      </button>
      <input
        type="range"
        className="disc-range w-24"
        aria-label="Volume"
        aria-valuetext={`${Math.round(shown * 100)} percent`}
        min={0}
        max={1}
        step={0.01}
        value={shown}
        style={{ '--pct': `${shown * 100}%` }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (muted && v > 0) usePlayer.setState({ muted: false });
          setVolume(v);
        }}
      />
    </div>
  );
}
