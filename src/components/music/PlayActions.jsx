'use client';
import { ListEnd, ListPlus, Play, Shuffle } from 'lucide-react';
import { usePlayer } from '@/lib/player/playerStore';
import { useDialogs } from '@/lib/dialogStore';
import { toast } from '@/lib/toastStore';

/** Play / Shuffle / Queue / Save-as-playlist for any list of tracks. */
export function PlayActions({ tracks, source, savePlaylist = false }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const playShuffled = usePlayer((s) => s.playShuffled);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const openCreate = useDialogs((s) => s.openCreatePlaylist);
  const playable = tracks.filter((t) => t.isPlayable);
  const none = playable.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-primary" disabled={none} onClick={() => playTracks(playable, 0, source)}><Play size={16} fill="currentColor" /> Play</button>
      <button type="button" className="btn-secondary" disabled={none} onClick={() => playShuffled(playable, source)}><Shuffle size={16} /> Shuffle</button>
      <button type="button" className="btn-secondary" disabled={none} onClick={() => { addToQueue(playable); toast(`Added ${playable.length} to queue`); }}><ListEnd size={16} /> Add to queue</button>
      {savePlaylist && <button type="button" className="btn-ghost" disabled={!tracks.length} onClick={() => openCreate(tracks)}><ListPlus size={16} /> Save as playlist</button>}
    </div>
  );
}
