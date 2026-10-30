import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { usePlayer, useProgress, initialPlayer, playThresholdSeconds } from '@/lib/player/playerStore';
import { useLibrary, initialData } from '@/lib/storage/libraryStore';
import { useSettings, DEFAULT_SETTINGS } from '@/lib/storage/settingsStore';
import { useAudioController } from '@/hooks/useAudioController';
import { __resetAudioForTests, getAudio } from '@/lib/player/audioEngine';
import { makeList, makeTrack } from './helpers';

function Host() {
  useAudioController();
  return null;
}
const fire = (name) => act(() => void getAudio().dispatchEvent(new Event(name)));

beforeEach(() => {
  usePlayer.setState(initialPlayer());
  useLibrary.setState({ ...initialData() });
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
  useProgress.setState({ currentTime: 0, duration: 0, buffered: 0 });
  __resetAudioForTests();
});

describe('player store', () => {
  it('starts playback of a list and tracks the current track metadata', () => {
    const l = makeList(3);
    usePlayer.getState().playTracks(l, 1);
    const s = usePlayer.getState();
    expect(s.current().id).toBe(l[1].id);
    expect(s.intent).toBe('play');
    expect(s.status).toBe('loading');
    s.next();
    expect(usePlayer.getState().current().id).toBe(l[2].id);
    usePlayer.getState().prev(0);
    expect(usePlayer.getState().current().id).toBe(l[1].id);
  });
  it('prev restarts the track when more than 3 s in', () => {
    const l = makeList(2);
    usePlayer.getState().playTracks(l, 1);
    const token = usePlayer.getState().playToken;
    usePlayer.getState().prev(10);
    expect(usePlayer.getState().current().id).toBe(l[1].id);
    expect(usePlayer.getState().playToken).toBe(token + 1);
  });
  it('toggles play and pause by intent', () => {
    usePlayer.getState().playTracks(makeList(1));
    usePlayer.getState().setStatus('playing');
    usePlayer.getState().togglePlay();
    expect(usePlayer.getState().intent).toBe('pause');
    usePlayer.getState().togglePlay();
    expect(usePlayer.getState().intent).toBe('play');
  });
  it('cycles repeat modes off → all → one → off', () => {
    const seen = [];
    for (let i = 0; i < 3; i++) {
      usePlayer.getState().cycleRepeat();
      seen.push(usePlayer.getState().repeat);
    }
    expect(seen).toEqual(['all', 'one', 'off']);
  });
  it('queue operations keep the active track consistent', () => {
    const [a, b, c] = makeList(3);
    usePlayer.getState().playTracks([a, b]);
    usePlayer.getState().playNext(c);
    expect(usePlayer.getState().queue.map((i) => i.track.id)).toEqual([a.id, c.id, b.id]);
    usePlayer.getState().reorderQueue(1, 2);
    expect(usePlayer.getState().current().id).toBe(a.id);
    usePlayer.getState().clearQueue();
    expect(usePlayer.getState().queue).toHaveLength(1);
  });
  it('shuffle never mutates the source list', () => {
    const l = makeList(5);
    const copy = l.map((t) => t.id);
    usePlayer.getState().playShuffled(l);
    expect(l.map((t) => t.id)).toEqual(copy);
  });
  it('refuses to "play" an unplayable track and says why', () => {
    const dead = makeTrack({ streamUrl: null, previewUrl: null });
    usePlayer.getState().playTracks([dead]);
    const s = usePlayer.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/playable URL|not playable/i);
    expect(s.intent).toBe('pause');
  });
  it('repeat one replays on natural end; autoplay off stops', () => {
    usePlayer.getState().playTracks(makeList(2));
    usePlayer.setState({ repeat: 'one' });
    const token = usePlayer.getState().playToken;
    usePlayer.getState().handleEnded();
    expect(usePlayer.getState().playToken).toBe(token + 1);
    usePlayer.setState({ repeat: 'off' });
    useSettings.setState({ autoplayNext: false });
    usePlayer.getState().handleEnded();
    expect(usePlayer.getState().status).toBe('paused');
  });
  it('counts a play only after a sensible listening threshold', () => {
    expect(playThresholdSeconds(200)).toBe(30);
    expect(playThresholdSeconds(40)).toBe(20);
    expect(playThresholdSeconds(NaN)).toBe(15); // unknown duration: 15 s
  });
});

describe('audio controller (mocked media element)', () => {
  it('loads the stream URL, reports playing, and records exactly one play', () => {
    render(<Host />);
    const t = makeTrack({ duration: 40 });
    act(() => usePlayer.getState().playTracks([t]));
    return Promise.resolve().then(() => {
      const audio = getAudio();
      expect(audio.src).toBe(t.streamUrl);
      fire('playing');
      expect(usePlayer.getState().status).toBe('playing');
      // simulate steady playback, one tick per second for 25 s (threshold is 20 s for a 40 s track)
      for (let s = 1; s <= 25; s++) {
        Object.defineProperty(audio, 'currentTime', { configurable: true, value: s });
        fire('timeupdate');
      }
      expect(useLibrary.getState().history).toHaveLength(1);
      expect(useLibrary.getState().history[0].track.id).toBe(t.id);
    });
  });
  it('a selected-but-never-heard track is not recorded as a play', async () => {
    render(<Host />);
    act(() => usePlayer.getState().playTracks(makeList(2)));
    await Promise.resolve();
    act(() => usePlayer.getState().next());
    expect(useLibrary.getState().history).toHaveLength(0);
  });
  it('a media error leaves an honest error state, never "playing"', async () => {
    render(<Host />);
    act(() => usePlayer.getState().playTracks([makeTrack()]));
    await Promise.resolve();
    Object.defineProperty(getAudio(), 'error', { configurable: true, value: { code: 4 } });
    fire('error');
    const s = usePlayer.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/unavailable|not supported|expired/i);
  });
  it('after a failure it skips ahead (bounded) when autoplay is on', async () => {
    render(<Host />);
    const [a, b] = makeList(2);
    act(() => usePlayer.getState().playTracks([a, b]));
    await Promise.resolve();
    Object.defineProperty(getAudio(), 'error', { configurable: true, value: { code: 2 } });
    fire('error');
    expect(usePlayer.getState().current().id).toBe(b.id);
    expect(usePlayer.getState().notice).toMatch(/skipped/i);
  });
  it('rejects unsafe media URLs', async () => {
    render(<Host />);
    const bad = makeTrack({ streamUrl: 'javascript:alert(1)', previewUrl: null });
    expect(bad.isPlayable).toBe(false);
    act(() => usePlayer.getState().playTracks([bad]));
    expect(usePlayer.getState().status).toBe('error');
  });
});
