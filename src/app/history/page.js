'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { History as HistoryIcon, Trash2, X } from 'lucide-react';
import { TrackRow } from '@/components/music/TrackRow';
import { PlayActions } from '@/components/music/PlayActions';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FilterBar } from '@/components/ui/Controls';
import { EmptyState, RowSkeletons } from '@/components/ui/States';
import { useHydrated } from '@/hooks/useHydrated';
import { useLibrary } from '@/lib/storage/libraryStore';
import { usePlayer } from '@/lib/player/playerStore';
import { activityByDay, summarizeListening } from '@/lib/recommendations/engine';
import { formatDuration, formatRelativeTime, formatTotalTime, pluralize } from '@/lib/utilities/format';
import { toast } from '@/lib/toastStore';

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']];

function Stats({ history }) {
  const [days, setDays] = useState(30);
  const sum = useMemo(() => summarizeListening(history, { days }), [history, days]);
  const chartDays = days === 7 ? 7 : 14;
  const bars = useMemo(() => activityByDay(history, { days: chartDays }), [history, chartDays]);
  const max = Math.max(1, ...bars.map((b) => b.plays));
  return (
    <section aria-labelledby="stats-h" className="rounded-card border border-line bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stats-h" className="section-title">Your listening</h2>
        <label className="sr-only" htmlFor="range">Date range</label>
        <select id="range" className="field !w-auto !rounded-full !py-1.5" value={days} onChange={(e) => setDays(Number(e.target.value))}>{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <p className="mt-1 text-xs text-muted">Computed on this device from your play history. A play counts once you’ve heard 30 seconds or half the track, whichever is shorter. Listening time is time actually spent playing.</p>
      {sum.plays === 0 ? <p className="mt-4 text-sm text-muted">No plays in this range yet.</p> : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Plays</dt><dd className="text-xl font-semibold tabular-nums">{sum.plays}</dd></div>
            <div><dt className="text-xs text-muted">Listening time</dt><dd className="text-xl font-semibold">{formatTotalTime(sum.totalSeconds) || '0m'}</dd></div>
            <div><dt className="text-xs text-muted">Distinct artists</dt><dd className="text-xl font-semibold tabular-nums">{sum.artists.length}</dd></div>
          </dl>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Top title="Most played artists" rows={sum.artists.slice(0, 5)} />
            <Top title="Most played tracks" rows={sum.tracks.slice(0, 5)} />
            <Top title="Top genres" rows={sum.genres.slice(0, 5)} empty="Sources didn’t tag genres on these tracks." />
          </div>
          <h3 className="mb-2 mt-6 text-sm font-medium">Plays per day, last {chartDays} days</h3>
          <div className="flex h-24 items-end gap-1" role="img" aria-label={`Plays per day: ${bars.map((b) => `${b.date} ${b.plays}`).join(', ')}`}>
            {bars.map((b) => <div key={b.date} title={`${b.date}: ${b.plays} ${pluralize(b.plays, 'play')}`} className="flex-1 rounded-t bg-accent/70" style={{ height: `${Math.max(b.plays ? 6 : 2, (b.plays / max) * 100)}%`, opacity: b.plays ? 1 : 0.25 }} />)}
          </div>
        </>
      )}
    </section>
  );
}

function Top({ title, rows, empty = 'Nothing yet.' }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {rows.length ? <ol className="space-y-1.5 text-sm">{rows.map((r) => <li key={r.key} className="flex justify-between gap-3"><span className="truncate">{r.label}</span><span className="shrink-0 tabular-nums text-muted">{r.plays}</span></li>)}</ol> : <p className="text-sm text-muted">{empty}</p>}
    </div>
  );
}

export default function HistoryPage() {
  const hydrated = useHydrated();
  const history = useLibrary((s) => s.history);
  const { removeHistoryEntry, clearHistory } = useLibrary.getState();
  const playTracks = usePlayer((s) => s.playTracks);
  const [q, setQ] = useState('');
  const [order, setOrder] = useState('newest');
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? history.filter((h) => `${h.track.title} ${h.track.artists.map((a) => a.name).join(' ')} ${h.track.album?.title || ''}`.toLowerCase().includes(t)) : history;
    return order === 'oldest' ? [...list].sort((a, b) => a.playedAt - b.playedAt) : order === 'longest' ? [...list].sort((a, b) => b.listenedSec - a.listenedSec) : list;
  }, [history, q, order]);
  const tracks = rows.map((h) => h.track);

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Listening History</h1>
        <button type="button" className="btn-ghost" disabled={!history.length} onClick={() => setConfirm(true)}><Trash2 size={16} /> Clear history</button>
      </div>
      <p className="mt-1 text-sm text-muted">Stored only in this browser. It’s used for your recommendations and never sent anywhere.</p>
      {!hydrated ? <div className="mt-6"><RowSkeletons /></div> : history.length === 0 ? (
        <div className="mt-6"><EmptyState icon={HistoryIcon} title="Nothing played yet" action={<Link href="/discover" className="btn-primary">Find something to play</Link>}>Tracks appear here after you’ve actually listened to them, not just selected them.</EmptyState></div>
      ) : (
        <>
          <div className="mt-5"><Stats history={history} /></div>
          <h2 className="section-title mb-3 mt-8">Recently played</h2>
          <div className="mb-3 space-y-3">
            <PlayActions tracks={tracks.filter((t, i) => tracks.findIndex((x) => x.id === t.id) === i)} source={{ type: 'history', name: 'History' }} />
            <div className="flex flex-wrap items-center gap-2">
              <FilterBar query={q} onQuery={setQ} label="Search history" />
              <label htmlFor="order" className="sr-only">Order</label>
              <select id="order" className="field !w-auto !rounded-full !py-2" value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="longest">Longest listened</option>
              </select>
            </div>
          </div>
          {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No history matches “{q}”.</p> : (
            <ul className="space-y-0.5">
              {rows.slice(0, 200).map((h, i) => (
                <li key={h.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1"><TrackRow track={h.track} index={i} showIndex={false} showAlbum={false} onPlay={() => (h.track.isPlayable ? playTracks(tracks, i, { type: 'history', name: 'History' }) : toast(h.track.playabilityReason || 'Unavailable', { tone: 'error' }))} /></div>
                  <span className="hidden w-28 shrink-0 text-right text-xs text-muted sm:block" title={new Date(h.playedAt).toLocaleString()}>{formatRelativeTime(h.playedAt)}<br />{formatDuration(h.listenedSec)} heard{h.completed ? ' · finished' : ''}</span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${h.track.title} from history`} onClick={() => removeHistoryEntry(h.id)}><X size={16} /></button>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 200 && <p className="mt-3 text-center text-xs text-muted">Showing the first 200 of {rows.length} plays.</p>}
        </>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Clear listening history?" message="This deletes every recorded play and early-skip signal. Your recommendations will start over. This can’t be undone." confirmLabel="Clear history" onConfirm={() => { clearHistory(); toast('History cleared'); }} />
    </div>
  );
}
