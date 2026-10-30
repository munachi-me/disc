'use client';
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, Download, Upload } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Controls';
import { useAsync } from '@/hooks/useAsync';
import { ACCENTS, DEFAULT_SETTINGS, useSettings } from '@/lib/storage/settingsStore';
import { exportLibrary, importLibrary, useLibrary } from '@/lib/storage/libraryStore';
import { clearAllLocalData } from '@/lib/storage/persistence';
import { clearApiCache, fetchProviders } from '@/lib/client/api';
import { initialPlayer, usePlayer } from '@/lib/player/playerStore';
import { providerName } from '@/components/music/Badges';
import { toast } from '@/lib/toastStore';

function Section({ title, children, description }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-2 divide-y divide-line rounded-card border border-line bg-card px-4">{children}</div>
    </section>
  );
}
const Row = ({ title, desc, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="min-w-0 max-w-md"><p className="text-sm font-medium">{title}</p>{desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export default function SettingsPage() {
  const s = useSettings();
  const { update } = s;
  const setVolume = usePlayer((p) => p.setVolume);
  const volume = usePlayer((p) => p.volume);
  const { data: providers } = useAsync((signal) => fetchProviders({ signal }), []);
  const fileRef = useRef(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'history' | 'searches' | 'all'
  const lib = useLibrary.getState();

  const configured = (id) => providers?.providers.find((p) => p.id === id);
  const move = (id, dir) => {
    const order = [...s.providerOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    update({ providerOrder: order });
  };

  function doExport() {
    const blob = new Blob([JSON.stringify(exportLibrary(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disc-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function onPick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast('That file is too large to be a DISC export.', { tone: 'error' });
    try {
      setPendingImport(JSON.parse(await f.text()));
    } catch {
      toast('That file isn’t valid JSON.', { tone: 'error' });
    }
  }
  function runImport(mode) {
    try {
      const r = importLibrary(pendingImport, { mode });
      toast(`Imported ${r.favorites} favorites, ${r.playlists} playlists, ${r.history} plays`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
    setPendingImport(null);
  }

  return (
    <div className="page max-w-3xl">
      <h1 className="page-title">Settings</h1>

      <Section title="Appearance">
        <Row title="Accent colour" desc="DISC stays dark; only the purple accent changes.">
          {Object.entries(ACCENTS).map(([id, a]) => (
            <button key={id} type="button" className="chip" aria-pressed={s.accent === id} onClick={() => update({ accent: id })}>
              <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${a.rgb})` }} aria-hidden="true" /> {a.label}
            </button>
          ))}
        </Row>
      </Section>

      <Section title="Playback">
        <Row title="Default volume" desc="Also changes the player volume.">
          <input type="range" aria-label="Default volume" className="disc-range w-40" min={0} max={1} step={0.01} value={volume} style={{ '--pct': `${volume * 100}%` }} onChange={(e) => setVolume(Number(e.target.value))} />
        </Row>
        <Switch id="autoplay" label="Autoplay next track" description="Keep playing through the queue when a track ends. Browsers may still block the very first play until you press a button." checked={s.autoplayNext} onChange={(v) => update({ autoplayNext: v })} />
        <Switch id="shuffle" label="Start with shuffle on" description="Shuffle only changes the order of the queue; your playlists are never reordered." checked={s.shuffle} onChange={(v) => { update({ shuffle: v }); usePlayer.getState().setShuffle(v); }} />
        <Row title="Audio quality" desc="Only Jamendo offers a choice (MP3 high or standard). iTunes previews and Internet Archive files play as provided.">
          {['high', 'standard'].map((q) => <button key={q} type="button" className="chip" aria-pressed={s.quality === q} onClick={() => update({ quality: q })}>{q === 'high' ? 'High' : 'Standard'}</button>)}
        </Row>
        <Switch id="explicit" label="Hide explicit tracks" description="Works only where a source labels tracks as explicit (iTunes does; Jamendo and the Internet Archive generally don’t), so unlabeled tracks still appear." checked={s.explicit === 'hide'} onChange={(v) => update({ explicit: v ? 'hide' : 'allow' })} />
      </Section>

      <Section title="Music sources" description="Turn sources on or off and set the order used when results are mixed. Credentials live in .env.local on the server and are never shown here.">
        {s.providerOrder.map((id, i) => {
          const info = configured(id);
          return (
            <div key={id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                {info ? (info.configured ? <CheckCircle2 size={16} className="mt-0.5 text-accent-bright" aria-label="Connected" /> : <CircleDashed size={16} className="mt-0.5 text-muted" aria-label="Not connected" />) : <span className="w-4" />}
                <div>
                  <p className="text-sm font-medium">{providerName(id)}</p>
                  <p className="text-xs text-muted">{info ? `${info.configured ? 'Ready' : 'Not connected'} · ${info.description}` : 'Checking…'}</p>
                  {info && !info.configured && <p className="text-xs text-muted">Add its key to .env.local, then restart the server (see README).</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="icon-btn" aria-label={`Move ${providerName(id)} up`} disabled={i === 0} onClick={() => move(id, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" aria-label={`Move ${providerName(id)} down`} disabled={i === s.providerOrder.length - 1} onClick={() => move(id, 1)}><ArrowDown size={16} /></button>
                <button type="button" role="switch" aria-checked={s.providers[id]} aria-label={`Use ${providerName(id)}`} onClick={() => update({ providers: { ...s.providers, [id]: !s.providers[id] } })} className={`relative ml-2 h-6 w-11 rounded-full ${s.providers[id] ? 'bg-accent' : 'bg-elevated'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.providers[id] ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          );
        })}
        <Row title="Lyrics" desc={providers ? (providers.lyrics.configured ? 'Musixmatch is configured (free plans return partial lyrics).' : 'Not configured. Set MUSIXMATCH_API_KEY to enable lyrics in the full player.') : 'Checking…'} />
      </Section>

      <Section title="Your data" description="Everything is stored in this browser. Nothing is uploaded or synced.">
        <Row title="Export library" desc="Favorites, saved albums, followed artists, playlists, history and recent searches as a JSON file. Imported audio files are not included.">
          <button type="button" className="btn-secondary" onClick={doExport}><Download size={16} /> Export</button>
        </Row>
        <Row title="Import library" desc="Merge a previous DISC export into this browser, or replace what’s here.">
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPick} aria-label="Choose DISC export file" />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16} /> Choose file</button>
        </Row>
        <Row title="Search history"><button type="button" className="btn-secondary" disabled={!lib.searches.length} onClick={() => setConfirm('searches')}>Clear</button></Row>
        <Row title="Listening history" desc="Also resets what recommendations know about your listening."><button type="button" className="btn-secondary" onClick={() => setConfirm('history')}>Clear</button></Row>
        <Row title="Recommendation memory" desc="Forget which tracks were already recommended and which you skipped."><button type="button" className="btn-secondary" onClick={() => { useLibrary.getState().resetRecommendationMemory(); toast('Recommendation memory reset'); }}>Reset</button></Row>
        <Row title="Clear cached results" desc="Drops cached search and browse results held in memory."><button type="button" className="btn-secondary" onClick={() => { clearApiCache(); toast('Cache cleared'); }}>Clear cache</button></Row>
        <Row title="Clear all local data" desc="Deletes your library, imported audio files and settings from this browser."><button type="button" className="btn-danger" onClick={() => setConfirm('all')}>Clear everything</button></Row>
      </Section>

      <ConfirmDialog open={confirm === 'searches'} onClose={() => setConfirm(null)} title="Clear search history?" message="Your recent searches will be removed." confirmLabel="Clear" onConfirm={() => { useLibrary.getState().clearSearches(); toast('Search history cleared'); }} />
      <ConfirmDialog open={confirm === 'history'} onClose={() => setConfirm(null)} title="Clear listening history?" message="All recorded plays and skip signals are deleted. This can’t be undone." confirmLabel="Clear history" onConfirm={() => { useLibrary.getState().clearHistory(); toast('Listening history cleared'); }} />
      <ConfirmDialog
        open={confirm === 'all'}
        onClose={() => setConfirm(null)}
        title="Clear all local data?"
        message="This permanently deletes favorites, playlists, history, imported audio files and settings from this browser, and stops playback. Export your library first if you want a copy."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          usePlayer.setState(initialPlayer());
          await clearAllLocalData();
          useSettings.setState({ ...DEFAULT_SETTINGS });
          clearApiCache();
          toast('All local data cleared');
        }}
      />
      {pendingImport && (
        <ConfirmDialog open onClose={() => setPendingImport(null)} title="Import library" danger={false} confirmLabel="Merge" message="Merge adds the file’s contents to what’s already here. To replace your current library instead, choose Replace below." onConfirm={() => runImport('merge')} />
      )}
      {pendingImport && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 md:bottom-28">
          <button type="button" className="btn-danger shadow-lg" onClick={() => runImport('replace')}>Replace current library instead</button>
        </div>
      )}
    </div>
  );
}
