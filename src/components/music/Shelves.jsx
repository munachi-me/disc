'use client';
import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import { Shelf, TrackCard } from './Cards';
import { CardSkeletons, ProviderErrors } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useMusicParamsKey } from '@/hooks/useMusicParams';
import { browseMusic } from '@/lib/client/api';

/** A horizontally scrolling shelf of tracks loaded from the providers. Handles loading, empty, error and "not connected". */
export function TrackShelf({ title, subtitle, kind, value, order, only, offset = 0, limit = 18, source, action, onLoaded }) {
  const key = useMusicParamsKey();
  const { data, error, loading, retry } = useAsync(
    async (signal) => {
      const r = await browseMusic({ kind, value, order, only, offset, limit }, { signal });
      onLoaded?.(r);
      return r;
    },
    [kind, value, order, offset, limit, key, only?.join(',')],
  );
  return (
    <Shelf title={title} subtitle={subtitle} action={action}>
      {loading && !data ? (
        <CardSkeletons count={6} />
      ) : error ? (
        <ShelfMessage message={error.message} onRetry={retry} />
      ) : data?.tracks.length ? (
        <>
          <ProviderErrors errors={data.errors} onRetry={retry} />
          <div className="scroll-x">
            {data.tracks.map((t, i) => (
              <TrackCard key={`${t.id}-${i}`} track={t} tracks={data.tracks} index={i} source={source || { type: 'shelf', name: title }} />
            ))}
          </div>
        </>
      ) : (
        <>
          <ProviderErrors errors={data?.errors || []} onRetry={retry} />
          {!data?.errors?.length && <ShelfMessage message="No tracks came back for this category right now." onRetry={retry} />}
        </>
      )}
    </Shelf>
  );
}

export function ShelfMessage({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-card px-4 py-3 text-sm text-muted" role="status">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button type="button" className="btn-secondary !py-1.5" onClick={onRetry}>Retry</button>}
      <Link href="/settings" className="inline-flex items-center gap-1 text-accent-bright hover:underline"><Settings2 size={14} aria-hidden="true" /> Music sources</Link>
    </div>
  );
}

export function TrackCardShelf({ title, subtitle, items, source, action }) {
  if (!items?.length) return null;
  const tracks = items.map((x) => x.track || x);
  return (
    <Shelf title={title} subtitle={subtitle} action={action}>
      <div className="scroll-x">
        {tracks.map((t, i) => (
          <TrackCard key={`${t.id}-${i}`} track={t} tracks={tracks} index={i} source={source || { type: 'shelf', name: title }} reason={items[i].reasons?.[0]} />
        ))}
      </div>
    </Shelf>
  );
}
