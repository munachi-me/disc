'use client';
import { ArrowDown, ArrowUp, ListMusic, Trash2, X } from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { PlaybackBadge } from '@/components/music/Badges';
import { EmptyState } from '@/components/ui/States';
import { usePlayer } from '@/lib/player/playerStore';
import { formatDuration } from '@/lib/utilities/format';

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const currentQid = usePlayer((s) => s.currentQid);
  const { jumpTo, removeFromQueue, reorderQueue, clearQueue } = usePlayer.getState();
  const idx = queue.findIndex((i) => i.qid === currentQid);
  if (!queue.length) return <EmptyState icon={ListMusic} title="Your queue is empty">Play a track, or choose “Add to queue” from a track’s menu.</EmptyState>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted">{queue.length} in queue{idx >= 0 ? ` · ${queue.length - idx - 1} up next` : ''}</p>
        <button type="button" className="btn-ghost !px-3 !py-1.5" onClick={clearQueue} disabled={queue.length <= 1}>
          <Trash2 size={14} /> Clear queue
        </button>
      </div>
      <ol className="space-y-0.5">
        {queue.map((item, i) => {
          const t = item.track;
          const current = item.qid === currentQid;
          return (
            <li key={item.qid} aria-current={current ? 'true' : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${current ? 'bg-card' : 'hover:bg-card/60'} ${t.isPlayable ? '' : 'opacity-60'}`}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => jumpTo(item.qid)} aria-label={`Play ${t.title}`}>
                <Artwork src={t.artworkUrl} alt="" seed={t.id} className="h-10 w-10 shrink-0" rounded="rounded-md" size={14} />
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${current ? 'font-semibold text-accent-bright' : ''}`}>{current && <span className="sr-only">Now playing: </span>}{t.title}</span>
                  <span className="flex items-center gap-2 truncate text-xs text-muted">{t.artists[0]?.name} <PlaybackBadge track={t} compact /></span>
                </span>
              </button>
              <span className="hidden text-xs tabular-nums text-muted sm:block">{t.playbackType === 'preview' ? '0:30' : t.duration ? formatDuration(t.duration) : ''}</span>
              <button type="button" className="icon-btn !h-8 !w-8" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => reorderQueue(i, i - 1)}><ArrowUp size={15} /></button>
              <button type="button" className="icon-btn !h-8 !w-8" aria-label={`Move ${t.title} down`} disabled={i === queue.length - 1} onClick={() => reorderQueue(i, i + 1)}><ArrowDown size={15} /></button>
              <button type="button" className="icon-btn !h-8 !w-8" aria-label={`Remove ${t.title} from queue`} onClick={() => removeFromQueue(item.qid)}><X size={15} /></button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
