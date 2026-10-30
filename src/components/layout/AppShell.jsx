'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomNav, MobileHeader, Sidebar } from './Sidebar';
import { PlayerBar } from '@/components/player/PlayerBar';
import { ExpandedPlayer } from '@/components/player/ExpandedPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { Dialog } from '@/components/ui/Dialog';
import { ToastHost } from '@/components/ui/ToastHost';
import { TrackMenu } from '@/components/music/TrackMenu';
import { AddToPlaylistDialog, CreatePlaylistDialog } from '@/components/playlists/PlaylistDialogs';
import { useAudioController } from '@/hooks/useAudioController';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { startLibraryPersistence, stopLibraryPersistence } from '@/lib/storage/persistence';
import { ACCENTS, useSettings } from '@/lib/storage/settingsStore';
import { useLibrary } from '@/lib/storage/libraryStore';
import { usePlayer } from '@/lib/player/playerStore';

export function AppShell({ children }) {
  useAudioController();
  useGlobalShortcuts();
  const accent = useSettings((s) => s.accent);
  const storageError = useLibrary((s) => s.storageError);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);

  useEffect(() => {
    useSettings.getState().load();
    startLibraryPersistence();
    return () => stopLibraryPersistence();
  }, []);
  useEffect(() => {
    const a = ACCENTS[accent] || ACCENTS.violet;
    document.documentElement.style.setProperty('--accent', a.rgb);
    document.documentElement.style.setProperty('--accent-bright', a.bright);
  }, [accent]);

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2">Skip to content</a>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden focus:outline-none">
          <MobileHeader />
          {storageError && (
            <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200 md:mx-8">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {storageError}
            </div>
          )}
          {children}
        </main>
      </div>
      <PlayerBar />
      <BottomNav />
      <ExpandedPlayer />
      <Dialog open={queueOpen} onClose={() => setQueueOpen(false)} title="Queue" wide sheet>
        <QueuePanel />
      </Dialog>
      <TrackMenu />
      <AddToPlaylistDialog />
      <CreatePlaylistDialog />
      <ToastHost />
    </div>
  );
}
