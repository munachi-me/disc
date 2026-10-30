'use client';
import { useRef, useState } from 'react';
import { FileAudio, Loader2 } from 'lucide-react';
import { useLibrary } from '@/lib/storage/libraryStore';
import { toast } from '@/lib/toastStore';

/** Import audio files you own. Files are stored in this browser's IndexedDB and never uploaded. */
export function LocalImport() {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const addLocalTrack = useLibrary((s) => s.addLocalTrack);

  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const { importAudioFile } = await import('@/lib/player/localFiles');
    let ok = 0;
    for (const file of files) {
      try {
        addLocalTrack(await importAudioFile(file));
        ok += 1;
      } catch (err) {
        toast(err?.name === 'QuotaExceededError' ? 'Your browser has no space left for this file.' : err.message || 'Could not import this file.', { tone: 'error', ms: 7000 });
      }
    }
    setBusy(false);
    if (ok) toast(`Imported ${ok} ${ok === 1 ? 'file' : 'files'}`);
  }

  return (
    <div>
      <input ref={ref} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" multiple hidden onChange={onFiles} aria-label="Choose audio files to import" />
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileAudio size={16} />} Import audio files
      </button>
      <p className="mt-2 max-w-xl text-xs text-muted">Only import music you own or are allowed to use. Files stay in this browser’s storage on this device. They are never uploaded, are not exported with your library, and can disappear if you clear site data. Format support depends on your browser.</p>
    </div>
  );
}
