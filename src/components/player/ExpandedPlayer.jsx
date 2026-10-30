'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, ListMusic, ListPlus, Mic2, Music2 } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { ArtistLinks } from '@/components/music/ArtistLinks';
import { PlaybackBadge, providerName } from '@/components/music/Badges';
import { FavoriteButton } from '@/components/music/TrackRow';
import { QueuePanel } from './QueuePanel';
import { SeekBar, TransportControls, VolumeControl, statusLine } from './Controls';
import { usePlayer } from '@/lib/player/playerStore';
import { useDialogs } from '@/lib/dialogStore';
import { albumHref } from '@/lib/links';
import { useAsync } from '@/hooks/useAsync';
import { fetchLyricsFor } from '@/lib/client/api';
import { authorizedLyricsLink } from '@/lib/music-providers/lyrics';
import { Skeleton } from '@/components/ui/States';

function Lyrics({ track }) {
  const artist = track.artists[0]?.name || '';
  const local = track.provider === 'local';
  const { data, error, loading, retry } = useAsync((signal) => fetchLyricsFor({ title: track.title, artist }, { signal }), [track.id], { enabled: !local });
  const link = authorizedLyricsLink(track.title, artist);
  if (local) return <p className="text-sm text-muted">Lyrics lookup is off for imported files so their names are never sent anywhere.</p>;
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (error?.code === 'credentials' || error?.status === 503)
    return (
      <div className="text-sm text-muted">
        <p>No lyrics provider is configured. DISC never generates or scrapes lyrics.</p>
        <p className="mt-2">Add <code className="font-mono text-fg">MUSIXMATCH_API_KEY</code> to <code className="font-mono text-fg">.env.local</code> to enable them.</p>
        <a className="mt-3 inline-flex items-center gap-1.5 text-accent-bright hover:underline" href={link} target="_blank" rel="noopener noreferrer">Search on Genius <ExternalLink size={14} /></a>
      </div>
    );
  if (error) return <div className="text-sm text-muted"><p>Couldn’t load lyrics: {error.message}</p><button type="button" className="btn-secondary mt-3" onClick={retry}>Try again</button></div>;
  if (!data?.found) return <div className="text-sm text-muted"><p>No lyrics found for this track.</p><a className="mt-2 inline-flex items-center gap-1.5 text-accent-bright hover:underline" href={link} target="_blank" rel="noopener noreferrer">Search on Genius <ExternalLink size={14} /></a></div>;
  return (
    <div>
      <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">{data.text}</pre>
      {data.partial && <p className="mt-3 text-xs text-muted">Partial lyrics (provider free plan).</p>}
      <p className="mt-1 text-xs text-muted">{data.attribution}{data.copyright ? ` · ${data.copyright}` : ''}</p>
    </div>
  );
}

export function ExpandedPlayer() {
  const open = usePlayer((s) => s.expanded);
  const track = usePlayer((s) => s.queue.find((i) => i.qid === s.currentQid)?.track || null);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const setExpanded = usePlayer((s) => s.setExpanded);
  const openAdd = useDialogs((s) => s.openAddToPlaylist);
  const [tab, setTab] = useState('now');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector('[data-autofocus]')?.focus();
    const onKey = (e) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, setExpanded]);
  useEffect(() => {
    if (open && !track) setExpanded(false);
  }, [open, track, setExpanded]);

  if (!open || !track) return null;
  const close = () => setExpanded(false);
  const tabs = [['now', 'Now playing', Music2], ['queue', 'Queue', ListMusic], ['lyrics', 'Lyrics', Mic2]];
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Full player" className="fixed inset-0 z-40 flex animate-sheet-up flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-3 py-2">
        <button type="button" data-autofocus className="icon-btn" aria-label="Close full player" onClick={close}><ChevronDown size={22} /></button>
        <div role="tablist" aria-label="Player view" className="flex gap-1 rounded-full bg-card p-1">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${tab === id ? 'bg-elevated text-fg' : 'text-muted'}`}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <span className="w-10" />
      </div>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-5 pb-4">
        {tab === 'now' && (
          <div className="flex flex-col items-center pt-2 md:pt-6">
            <Artwork src={track.artworkUrl} alt={`Artwork for ${track.title}`} seed={track.id} className="w-full max-w-[min(22rem,60vh)]" rounded="rounded-2xl" size={72} />
            <div className="mt-6 flex w-full items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{track.title}</h2>
                <p className="truncate text-sm text-muted"><ArtistLinks artists={track.artists} /></p>
                {track.album && <p className="truncate text-xs text-muted">{track.album.id ? <Link className="hover:underline" href={albumHref(track.album.id)} onClick={close}>{track.album.title}</Link> : track.album.title}</p>}
              </div>
              <div className="flex shrink-0">
                <FavoriteButton track={track} />
                <button type="button" className="icon-btn" aria-label="Add to playlist" onClick={() => openAdd([track])}><ListPlus size={20} /></button>
              </div>
            </div>
            <div className="mt-4 w-full"><SeekBar fallbackDuration={track.playbackType === 'preview' ? 30 : track.duration || 0} /></div>
            <div className="mt-2 w-full"><TransportControls size="lg" /></div>
            <VolumeControl className="mt-2 hidden md:flex" />
            <div className="mt-5 w-full rounded-card border border-line bg-card p-4 text-sm" role="status">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><PlaybackBadge track={track} /><span className={status === 'error' ? 'text-red-300' : 'text-muted'}>{statusLine({ status, error, track })}</span></div>
              <p className="mt-2 text-xs text-muted">Source: {providerName(track.provider)}{track.attribution ? ` · ${track.attribution}` : ''}</p>
              {track.license && <p className="mt-1 break-words text-xs text-muted">License: {track.license}</p>}
              {track.externalUrl && <a className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent-bright hover:underline" href={track.externalUrl} target="_blank" rel="noopener noreferrer">Open on {providerName(track.provider)} <ExternalLink size={12} /></a>}
            </div>
          </div>
        )}
        {tab === 'queue' && <QueuePanel />}
        {tab === 'lyrics' && <Lyrics track={track} />}
      </div>
    </div>
  );
}
