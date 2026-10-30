'use client';
import { useEffect, useState } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useLibrary } from '@/lib/storage/libraryStore';
import { useDialogs } from '@/lib/dialogStore';
import { toast } from '@/lib/toastStore';

export function CreatePlaylistDialog() {
  const state = useDialogs((s) => s.createPlaylist);
  const close = useDialogs((s) => s.closeCreatePlaylist);
  const create = useLibrary((s) => s.createPlaylist);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const open = Boolean(state);
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  function submit(e) {
    e.preventDefault();
    const id = create({ name: name.trim() || 'New playlist', description, tracks: state.tracks });
    toast(state.tracks.length ? `Created playlist with ${state.tracks.length} ${state.tracks.length === 1 ? 'track' : 'tracks'}` : 'Playlist created');
    close();
    return id;
  }

  return (
    <Dialog open={open} onClose={close} title="New playlist">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="pl-name" className="mb-1.5 block text-sm text-muted">
            Name
          </label>
          <input id="pl-name" data-autofocus className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="My playlist" />
        </div>
        <div>
          <label htmlFor="pl-desc" className="mb-1.5 block text-sm text-muted">
            Description (optional)
          </label>
          <textarea id="pl-desc" className="field min-h-[72px]" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {state?.tracks.length > 0 && <p className="text-sm text-muted">{state.tracks.length} {state.tracks.length === 1 ? 'track' : 'tracks'} will be added.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Create playlist
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddToPlaylistDialog() {
  const tracks = useDialogs((s) => s.addToPlaylist);
  const close = useDialogs((s) => s.closeAddToPlaylist);
  const openCreate = useDialogs((s) => s.openCreatePlaylist);
  const playlists = useLibrary((s) => s.playlists);
  const add = useLibrary((s) => s.addTracksToPlaylist);
  return (
    <Dialog open={Boolean(tracks)} onClose={close} title="Add to playlist" sheet>
      <button type="button" className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-card" onClick={() => openCreate(tracks)} data-autofocus>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-elevated text-accent-bright">
          <Plus size={18} />
        </span>
        New playlist
      </button>
      {playlists.length === 0 && <p className="px-3 py-2 text-sm text-muted">You have no playlists yet. Create one to start collecting tracks.</p>}
      <ul>
        {playlists.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-card"
              onClick={() => {
                const n = add(p.id, tracks);
                toast(n ? `Added ${n} to “${p.name}”` : `Already in “${p.name}”`);
                close();
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-elevated text-muted">
                <ListPlus size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block text-xs text-muted">{p.tracks.length} tracks</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
