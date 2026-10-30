'use client';
import { useEffect } from 'react';
import { usePlayer, useProgress, playThresholdSeconds } from '@/lib/player/playerStore';
import { describeMediaError, getAudio } from '@/lib/player/audioEngine';
import { getLocalFileUrl } from '@/lib/player/localFiles';
import { useLibrary } from '@/lib/storage/libraryStore';
import { useSettings } from '@/lib/storage/settingsStore';
import { safeMediaUrl } from '@/lib/utilities/url';

/**
 * Bridges the player store and the single <audio> element.
 * Owns: loading sources, play/pause, error reporting, progress, play counting, Media Session, cleanup.
 */
export function useAudioController() {
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return undefined;

    let objectUrl = null;
    let suppressPause = 0;
    let session = null; // { track, listened, lastTime, counted, entryId }

    const lib = () => useLibrary.getState();
    const store = () => usePlayer.getState();

    const syncVolume = () => {
      const { volume, muted } = store();
      audio.volume = volume;
      audio.muted = muted;
    };

    const finalizeSession = (reason) => {
      const s = session;
      session = null;
      if (!s) return;
      if (s.counted && s.entryId) {
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : s.track.duration;
        lib().updatePlay(s.entryId, { listenedSec: Math.round(s.listened), completed: reason === 'ended' || (dur ? s.listened >= dur * 0.9 : false) });
      } else if (reason === 'skip' && s.listened >= 1 && s.listened < 10) {
        lib().recordSkip(s.track); // an early, deliberate skip
      }
    };

    const releaseSource = () => {
      if (!audio.paused) suppressPause += 1;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const startPlayback = () => {
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (err?.name === 'AbortError') return; // superseded by a newer load
          if (err?.name === 'NotAllowedError') return store().needsGesture();
          store().playbackFailed(describeMediaError(audio.error) || 'This track could not be played.');
        });
      }
    };

    const load = async (skipReason = 'skip') => {
      finalizeSession(skipReason);
      releaseSource();
      useProgress.setState({ currentTime: 0, duration: 0, buffered: 0 });
      const { playToken } = store();
      const track = store().current();
      if (!track || !track.isPlayable) return;
      let url;
      try {
        url = track.provider === 'local' ? (objectUrl = await getLocalFileUrl(track)) : safeMediaUrl(track.streamUrl || track.previewUrl);
      } catch (err) {
        if (store().playToken === playToken) store().playbackFailed(err.message);
        return;
      }
      if (store().playToken !== playToken) {
        if (objectUrl && track.provider === 'local') {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        return; // a newer request replaced this one while we were resolving the URL
      }
      if (!url) return store().playbackFailed('This track’s media link was rejected as unsafe or is missing.');
      session = { track, listened: 0, lastTime: 0, counted: false, entryId: null };
      audio.src = url;
      syncVolume();
      if (store().intent === 'play') startPlayback();
    };

    const onTime = () => {
      const t = audio.currentTime || 0;
      useProgress.setState({ currentTime: t });
      if (!session) return;
      const delta = t - session.lastTime;
      if (store().status === 'playing' && delta > 0 && delta < 2) session.listened += delta; // seeks (big jumps) don't count
      session.lastTime = t;
      if (!session.counted && session.listened >= playThresholdSeconds(audio.duration || session.track.duration)) {
        session.counted = true;
        session.entryId = lib().recordPlay({ track: session.track, listenedSec: Math.round(session.listened), completed: false });
      }
    };
    const onDuration = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      useProgress.setState({ duration: d });
    };
    const onProgress = () => {
      const b = audio.buffered;
      useProgress.setState({ buffered: b && b.length ? b.end(b.length - 1) : 0 });
    };
    const onPlaying = () => store().setStatus('playing');
    const onWaiting = () => {
      if (store().intent === 'play') store().setStatus('loading');
    };
    const onPause = () => {
      if (suppressPause > 0) {
        suppressPause -= 1;
        return;
      }
      if (audio.ended || !audio.getAttribute('src')) return;
      store().pause(); // paused by hardware keys, headphones or the OS
      store().setStatus('paused');
    };
    const onEnded = () => {
      finalizeSession('ended');
      store().handleEnded();
    };
    const onError = () => {
      if (!audio.getAttribute('src')) return;
      store().playbackFailed(describeMediaError(audio.error));
    };
    const onSeeked = () => {
      if (session) session.lastTime = audio.currentTime;
    };

    const events = { timeupdate: onTime, durationchange: onDuration, loadedmetadata: onDuration, progress: onProgress, playing: onPlaying, waiting: onWaiting, pause: onPause, ended: onEnded, error: onError, seeked: onSeeked };
    for (const [e, h] of Object.entries(events)) audio.addEventListener(e, h);

    syncVolume();
    const unsubscribe = usePlayer.subscribe((s, prev) => {
      if (s.volume !== prev.volume || s.muted !== prev.muted) syncVolume();
      if (s.playToken !== prev.playToken) {
        load(s.currentQid === prev.currentQid ? 'restart' : 'skip');
        return;
      }
      if (s.intent !== prev.intent && audio.getAttribute('src')) {
        if (s.intent === 'play') startPlayback();
        else audio.pause();
      }
      if (s.status === 'idle' && prev.status !== 'idle' && !s.currentQid) {
        finalizeSession('skip');
        releaseSource();
      }
    });

    // Media Session: lock-screen / headset controls and metadata
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (ms) {
      const set = (a, fn) => {
        try {
          ms.setActionHandler(a, fn);
        } catch {
          /* unsupported action */
        }
      };
      set('play', () => usePlayer.setState({ intent: 'play' }));
      set('pause', () => store().pause());
      set('previoustrack', () => store().prev(audio.currentTime));
      set('nexttrack', () => store().next());
      set('seekto', (d) => {
        if (Number.isFinite(d?.seekTime)) audio.currentTime = d.seekTime;
      });
    }
    const unsubMeta = usePlayer.subscribe((s, prev) => {
      if (s.currentQid === prev.currentQid && s.status === prev.status) return;
      const t = s.current();
      if (typeof document !== 'undefined') document.title = t && s.status === 'playing' ? `${t.title} · ${t.artists[0]?.name} — DISC` : 'DISC — music discovery';
      if (ms && t && typeof MediaMetadata !== 'undefined') {
        try {
          ms.metadata = new MediaMetadata({ title: t.title, artist: t.artists.map((a) => a.name).join(', '), album: t.album?.title || '', artwork: t.artworkUrl ? [{ src: t.artworkUrl, sizes: '512x512' }] : [] });
        } catch {
          /* ignore */
        }
      }
      if (ms) ms.playbackState = s.status === 'playing' ? 'playing' : 'paused';
    });

    const onHide = () => finalizeSession('hide');
    window.addEventListener('pagehide', onHide);

    // If the persisted default volume loads after mount
    const unsubSettings = useSettings.subscribe((s, prev) => {
      if (s.loaded && !prev.loaded) usePlayer.setState({ volume: s.volume, shuffle: s.shuffle });
    });

    return () => {
      for (const [e, h] of Object.entries(events)) audio.removeEventListener(e, h);
      window.removeEventListener('pagehide', onHide);
      unsubscribe();
      unsubMeta();
      unsubSettings();
      finalizeSession('hide');
      releaseSource();
    };
  }, []);
}
