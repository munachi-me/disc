import { Ban, Clock, Disc3 } from 'lucide-react';

const NAMES = { itunes: 'iTunes', jamendo: 'Jamendo', archive: 'Internet Archive', local: 'On this device' };
export const providerName = (id) => NAMES[id] || id;

export function ProviderBadge({ provider }) {
  return <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{providerName(provider)}</span>;
}

/** Text + icon, never colour alone. */
export function PlaybackBadge({ track, compact = false }) {
  if (track.playbackType === 'full')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-accent-bright" title={track.provider === 'local' ? 'Imported file' : 'Full track'}>
        <Disc3 size={12} aria-hidden="true" /> {compact ? 'Full' : 'Full track'}
      </span>
    );
  if (track.playbackType === 'preview')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-300" title={track.playabilityReason || undefined}>
        <Clock size={12} aria-hidden="true" /> {compact ? 'Preview' : 'Preview clip'}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-red-300" title={track.playabilityReason || undefined}>
      <Ban size={12} aria-hidden="true" /> Unavailable
    </span>
  );
}

export function ExplicitTag() {
  return (
    <span className="ml-1.5 inline-flex h-4 items-center rounded-sm bg-elevated px-1 text-[10px] font-bold text-muted" title="Explicit" aria-label="Explicit">
      E
    </span>
  );
}
