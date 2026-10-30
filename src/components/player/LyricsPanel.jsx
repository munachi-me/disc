'use client';
import { ExternalLink, Music4 } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { fetchLyricsFor } from '@/lib/client/api';
import { authorizedLyricsLink } from '@/lib/music-providers/lyrics';
import { EmptyState, Skeleton } from '@/components/ui/States';

/** Lyrics come only from a licensed provider (Musixmatch) when configured. DISC never invents or scrapes lyrics. */
export function LyricsPanel({ track, active }) {
  const artist = track?.artists?.[0]?.name;
  const { data, error, loading } = useAsync((signal) => fetchLyricsFor({ title: track.title, artist }, { signal }), [track?.id], { enabled: Boolean(active && track && artist && track.provider !== 'local') });
  const link = track && artist ? authorizedLyricsLink(track.title, artist) : null;
  const linkEl = link && (
    <a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary">
      <ExternalLink size={16} /> Look up on Genius
    </a>
  );

  if (!track) return null;
  if (track.provider === 'local') return <EmptyState icon={Music4} title="No lyrics for imported files">DISC only fetches lyrics for tracks from music sources.</EmptyState>;
  if (loading) return <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-4/5" /></div>;
  if (error?.code === 'credentials' || error?.status === 503)
    return (
      <EmptyState icon={Music4} title="Lyrics aren’t set up" action={linkEl}>
        Add a Musixmatch key as MUSIXMATCH_API_KEY in .env.local to show licensed lyrics here. Until then, you can read them on an authorized site.
      </EmptyState>
    );
  if (error) return <EmptyState icon={Music4} title="Couldn’t load lyrics" action={linkEl}>{error.message}</EmptyState>;
  if (!data?.found) return <EmptyState icon={Music4} title="No lyrics found" action={linkEl}>The lyrics provider has no match for this track.</EmptyState>;
  return (
    <div>
      <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">{data.text}</pre>
      {data.partial && <p className="mt-4 text-xs text-muted">Partial lyrics, as provided by the free Musixmatch plan.</p>}
      <p className="mt-2 text-xs text-muted">{[data.attribution, data.copyright].filter(Boolean).join(' · ')}</p>
      <div className="mt-3">{linkEl}</div>
    </div>
  );
}
