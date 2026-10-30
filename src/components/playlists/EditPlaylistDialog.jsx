'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Artwork } from '@/components/music/Artwork';
import { useLibrary } from '@/lib/storage/libraryStore';
import { fileToCover } from '@/lib/utilities/image';
import { safeImageUrl } from '@/lib/utilities/url';
import { toast } from '@/lib/toastStore';

export function EditPlaylistDialog({ playlist, open, onClose }) {
  const update = useLibrary((s) => s.updatePlaylist);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');
  const file = useRef(null);
  useEffect(() => {
    if (open && playlist) {
      setName(playlist.name);
      setDescription(playlist.description || '');
      setCover(playlist.coverUrl || null);
      setCoverUrl('');
    }
  }, [open, playlist]);

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setCover(await fileToCover(f));
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }
  function useUrl() {
    const safe = safeImageUrl(coverUrl.trim());
    if (!safe) return toast('Enter a valid https:// image link.', { tone: 'error' });
    setCover(safe);
    setCoverUrl('');
  }
  function save(e) {
    e.preventDefault();
    if (!name.trim()) return toast('Give the playlist a name.', { tone: 'error' });
    update(playlist.id, { name, description, coverUrl: cover });
    toast('Playlist updated');
    onClose();
  }
  const trackArt = [...new Set(playlist?.tracks.map((t) => t.track.artworkUrl).filter(Boolean))].slice(0, 6);

  return (
    <Dialog open={open} onClose={onClose} title="Edit playlist">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4">
          <Artwork src={cover} alt="Playlist cover" seed={playlist?.id || ''} className="h-24 w-24 shrink-0" size={32} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} aria-label="Choose cover image" />
            <button type="button" className="btn-secondary" onClick={() => file.current?.click()}>Upload image</button>
            {cover && <button type="button" className="btn-ghost" onClick={() => setCover(null)}>Remove cover</button>}
          </div>
        </div>
        {trackArt.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm text-muted">Or use artwork from a track</p>
            <div className="flex gap-2 overflow-x-auto">
              {trackArt.map((u) => <button key={u} type="button" aria-label="Use this artwork" onClick={() => setCover(u)} className="shrink-0 rounded-md"><Artwork src={u} alt="" className="h-12 w-12" rounded="rounded-md" size={14} /></button>)}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="cover-url" className="sr-only">Image link</label>
          <input id="cover-url" className="field" placeholder="https:// image link" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
          <button type="button" className="btn-secondary" onClick={useUrl}>Use</button>
        </div>
        <div>
          <label htmlFor="ep-name" className="mb-1.5 block text-sm text-muted">Name</label>
          <input id="ep-name" data-autofocus className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ep-desc" className="mb-1.5 block text-sm text-muted">Description</label>
          <textarea id="ep-desc" className="field min-h-[72px]" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Dialog>
  );
}
