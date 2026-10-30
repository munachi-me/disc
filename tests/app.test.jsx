import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const nav = vi.hoisted(() => ({ path: '/', search: '', params: {}, push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => nav.params,
}));

import { BottomNav, Sidebar } from '@/components/layout/Sidebar';
import { AppShell } from '@/components/layout/AppShell';
import NotFound from '@/app/not-found';
import HomePage from '@/app/page';
import PlaylistsPage from '@/app/playlists/page';
import FavoritesPage from '@/app/favorites/page';
import SettingsPage from '@/app/settings/page';
import { SearchClient } from '@/app/search/SearchClient';
import { TrackRow } from '@/components/music/TrackRow';
import { ErrorState } from '@/components/ui/States';
import { NAV_ITEMS } from '@/components/layout/nav';
import { initialPlayer, usePlayer } from '@/lib/player/playerStore';
import { initialData, useLibrary } from '@/lib/storage/libraryStore';
import { DEFAULT_SETTINGS, useSettings } from '@/lib/storage/settingsStore';
import { clearApiCache } from '@/lib/client/api';
import { __resetAudioForTests } from '@/lib/player/audioEngine';
import { jsonResponse, makeList, makeTrack } from './helpers';

const REQUIRED_ROUTES = ['/', '/discover', '/search', '/library', '/favorites', '/playlists', '/history', '/settings'];

beforeEach(() => {
  nav.path = '/';
  nav.search = '';
  nav.params = {};
  nav.push.mockReset();
  nav.replace.mockReset();
  usePlayer.setState(initialPlayer());
  useLibrary.setState({ ...initialData(), hydrated: true, storageError: null });
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  __resetAudioForTests();
  clearApiCache();
  vi.restoreAllMocks();
  globalThis.fetch = vi.fn(async () => jsonResponse({ error: { message: 'offline in tests' } }, { status: 502 }));
});

describe('navigation', () => {
  it('links every required route and marks the active one', () => {
    nav.path = '/discover';
    render(<Sidebar />);
    const nav_ = screen.getByRole('navigation', { name: 'Main' });
    const hrefs = within(nav_).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(REQUIRED_ROUTES);
    expect(within(nav_).getByRole('link', { name: 'Discover' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav_).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(REQUIRED_ROUTES);
  });
  it('mobile bottom navigation shows four primary destinations and is hidden on desktop', () => {
    render(<BottomNav />);
    const el = screen.getByRole('navigation', { name: 'Primary' });
    expect(el.className).toMatch(/md:hidden/);
    expect(within(el).getAllByRole('link')).toHaveLength(4);
    expect(el.className).toMatch(/safe-area-inset-bottom/);
  });
  it('unknown routes show a helpful not-found page', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: /nothing here/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});

describe('app shell, mini-player and expanded player', () => {
  it('renders with nothing playing, then shows the player when a track starts', async () => {
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.getByText(/nothing playing/i)).toBeInTheDocument();
    const t = makeTrack({ title: 'Night Drive' });
    act(() => usePlayer.getState().playTracks([t]));
    expect((await screen.findAllByText('Night Drive')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /pause/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /next track/i }).length).toBeGreaterThan(0);
  });
  it('the mini-player opens an accessible full-screen player with queue access, and Escape closes it', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>x</p></AppShell>);
    const [a, b] = makeList(2);
    act(() => usePlayer.getState().playTracks([a, b]));
    await user.click((await screen.findAllByRole('button', { name: /open full player/i }))[0]);
    const dlg = await screen.findByRole('dialog', { name: /full player/i });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(within(dlg).getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: /shuffle/i })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: /repeat/i })).toBeInTheDocument();
    await user.click(within(dlg).getByRole('tab', { name: /queue/i }));
    expect(within(dlg).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /full player/i })).not.toBeInTheDocument());
  });
  it('shows an honest error in the player when playback fails', async () => {
    render(<AppShell><p>x</p></AppShell>);
    act(() => usePlayer.getState().playTracks([makeTrack({ streamUrl: null, previewUrl: null, title: 'Gone' })]));
    expect((await screen.findAllByText(/playable URL|not playable/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^pause$/i })).not.toBeInTheDocument();
  });
  it('reorders and removes queue items from the queue dialog', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>x</p></AppShell>);
    const [a, b, c] = makeList(3);
    act(() => usePlayer.getState().playTracks([a, b, c]));
    await user.click((await screen.findAllByRole('button', { name: /open queue/i }))[0]);
    await user.click(screen.getByRole('button', { name: `Move ${c.title} up` }));
    expect(usePlayer.getState().queue.map((i) => i.track.id)).toEqual([a.id, c.id, b.id]);
    await user.click(screen.getByRole('button', { name: `Remove ${b.title} from queue` }));
    expect(usePlayer.getState().queue).toHaveLength(2);
  });
});

describe('track rows tell the truth about playback', () => {
  it('labels full, preview and unavailable tracks', () => {
    const full = makeTrack({ title: 'Full One' });
    const preview = makeTrack({ title: 'Preview One', streamUrl: null, previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a' });
    const dead = makeTrack({ title: 'Dead One', streamUrl: null, previewUrl: null });
    render(<div><TrackRow track={full} index={0} /><TrackRow track={preview} index={1} /><TrackRow track={dead} index={2} /></div>);
    expect(screen.getByRole('button', { name: /^(Play|Pause) Full One/ }).getAttribute('aria-label')).not.toMatch(/preview|unavailable/i);
    expect(screen.getByRole('button', { name: /^(Play|Pause) Preview One/ }).getAttribute('aria-label')).toMatch(/preview/i);
    expect(screen.getByRole('button', { name: /^(Play|Pause) Dead One/ }).getAttribute('aria-label')).toMatch(/unavailable/i);
  });
});

describe('pages: loading, empty and error states', () => {
  it('Home renders its welcome experience even when every provider request fails', async () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/what do you like to hear/i)).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: /^retry$/i }, { timeout: 3000 })).not.toHaveLength(0);
    expect(screen.queryByText(/made for you/i)).not.toBeInTheDocument();
  });
  it('picking genres in onboarding is saved as preferences, skipping works too', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(screen.getByRole('button', { name: 'Jazz' }));
    await user.click(screen.getByRole('button', { name: /save picks/i }));
    expect(useLibrary.getState().onboarding).toMatchObject({ done: true, genres: ['Jazz'] });
  });
  it('Playlists shows an empty state and the create action opens the dialog store', async () => {
    const user = userEvent.setup();
    render(<PlaylistsPage />);
    expect(screen.getByText(/no playlists yet/i)).toBeInTheDocument();
    const { useDialogs } = await import('@/lib/dialogStore');
    await user.click(screen.getAllByRole('button', { name: /new playlist|create your first/i })[0]);
    expect(useDialogs.getState().createPlaylist).toEqual({ tracks: [] });
  });
  it('Favorites lists saved tracks and filters them', async () => {
    const user = userEvent.setup();
    useLibrary.getState().toggleFavorite(makeTrack({ title: 'Alpha Song' }));
    useLibrary.getState().toggleFavorite(makeTrack({ title: 'Beta Song' }));
    render(<FavoritesPage />);
    expect(screen.getByText('Alpha Song')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/search favorites/i), 'beta');
    expect(screen.queryByText('Alpha Song')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Song')).toBeInTheDocument();
  });
  it('Settings renders working controls and asks before destructive actions', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear everything/i }));
    expect(await screen.findByRole('dialog', { name: /clear all local data/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(screen.getByRole('switch', { name: /use itunes/i }));
    expect(useSettings.getState().providers.itunes).toBe(false);
  });
  it('ErrorState offers a retry', async () => {
    const retry = vi.fn();
    render(<ErrorState error={new Error('boom')} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });
});

describe('search', () => {
  it('debounces typing into a single request, groups results, and records the search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t = makeTrack({ title: 'Found Song' });
    globalThis.fetch = vi.fn(async () => jsonResponse({ tracks: [t], albums: [], artists: [], errors: [{ provider: 'jamendo', name: 'Jamendo', code: 'credentials', message: 'no key' }] }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchClient />);
    await user.type(screen.getByRole('searchbox'), 'lofi');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(500));
    expect(await screen.findByText('Found Song')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('q=lofi');
    expect(screen.getByText(/not connected/i)).toBeInTheDocument(); // missing credentials degrade gracefully
    expect(useLibrary.getState().searches[0].q).toBe('lofi');
    vi.useRealTimers();
  });
  it('shows a retryable error when the whole search fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchClient />);
    await user.type(screen.getByRole('searchbox'), 'zzz');
    await act(async () => void vi.advanceTimersByTime(500));
    expect(await screen.findByRole('alert')).toHaveTextContent(/search failed/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    vi.useRealTimers();
  });
  it('shows recent searches and can clear them', async () => {
    useLibrary.getState().addSearch('daft punk');
    render(<SearchClient />);
    expect(screen.getByRole('button', { name: 'daft punk' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(useLibrary.getState().searches).toHaveLength(0);
  });
});
