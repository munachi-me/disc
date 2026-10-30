import { beforeEach, describe, expect, it } from 'vitest';
import { exportLibrary, importLibrary, initialData, useLibrary } from '@/lib/storage/libraryStore';
import { normalizeLoaded, saveNow } from '@/lib/storage/persistence';
import { kvGet } from '@/lib/storage/idb';
import { filterEntries, sortEntries } from '@/lib/utilities/sort';
import { makeList, makeTrack } from './helpers';

const lib = () => useLibrary.getState();
beforeEach(() => useLibrary.setState({ ...initialData() }));

describe('favorites, albums, artists', () => {
  it('adds and removes a favorite by stable provider-qualified id', () => {
    const t = makeTrack({ providerTrackId: '42' });
    expect(lib().toggleFavorite(t)).toBe(true);
    expect(lib().favoriteTracks['jamendo:42']).toBeTruthy();
    expect(lib().toggleFavorite(t)).toBe(false);
    expect(lib().favoriteTracks['jamendo:42']).toBeUndefined();
  });
  it('same provider id on different providers does not collide', () => {
    lib().toggleFavorite(makeTrack({ provider: 'jamendo', providerTrackId: '1' }));
    lib().toggleFavorite(makeTrack({ provider: 'itunes', providerTrackId: '1', streamUrl: null, previewUrl: 'https://audio-ssl.itunes.apple.com/1.m4a' }));
    expect(Object.keys(lib().favoriteTracks).sort()).toEqual(['itunes:1', 'jamendo:1']);
  });
  it('saves albums and follows artists, rejecting invalid records', () => {
    expect(lib().toggleSaveAlbum({ provider: 'jamendo', providerId: '9', title: 'LP', artists: [{ name: 'X' }] })).toBe(true);
    expect(lib().toggleFollowArtist({ provider: 'jamendo', providerId: '5', name: 'Y' })).toBe(true);
    expect(Object.keys(lib().savedAlbums)).toEqual(['jamendo:9']);
    expect(Object.keys(lib().followedArtists)).toEqual(['jamendo:5']);
    expect(lib().toggleFavorite({ title: '' })).toBe(false);
  });
});

describe('playlists', () => {
  it('creates, renames, adds (no duplicates), removes, reorders, duplicates, deletes', () => {
    const [a, b, c] = makeList(3);
    const id = lib().createPlaylist({ name: '  Mix  ', tracks: [a] });
    expect(lib().playlists[0].name).toBe('Mix');
    expect(lib().addTracksToPlaylist(id, [a, b, c])).toBe(2);
    lib().renamePlaylist(id, 'Renamed');
    expect(lib().playlists[0].name).toBe('Renamed');
    lib().moveTrackInPlaylist(id, 0, 2);
    expect(lib().playlists[0].tracks.map((x) => x.track.id)).toEqual([b.id, c.id, a.id]);
    const pid = lib().playlists[0].tracks[1].pid;
    lib().removeTrackFromPlaylist(id, pid);
    expect(lib().playlists[0].tracks).toHaveLength(2);
    const copyId = lib().duplicatePlaylist(id);
    expect(lib().playlists).toHaveLength(2);
    expect(copyId).not.toBe(id);
    lib().deletePlaylist(id);
    expect(lib().playlists.map((p) => p.id)).toEqual([copyId]);
  });
  it('keeps each track’s original provider', () => {
    const itunes = makeTrack({ provider: 'itunes', providerTrackId: '7', streamUrl: null, previewUrl: 'https://audio-ssl.itunes.apple.com/7.m4a' });
    const id = lib().createPlaylist({ name: 'Mixed', tracks: [makeTrack(), itunes] });
    expect(lib().playlists.find((p) => p.id === id).tracks.map((x) => x.track.provider)).toEqual(['jamendo', 'itunes']);
  });
  it('rejects an unsafe cover url', () => {
    const id = lib().createPlaylist({ name: 'x' });
    lib().updatePlaylist(id, { coverUrl: 'javascript:alert(1)' });
    expect(lib().playlists[0].coverUrl).toBeNull();
  });
});

describe('persistence and export/import', () => {
  it('survives a "reload": saved to IndexedDB, then restored and re-validated', async () => {
    const t = makeTrack({ providerTrackId: 'persist' });
    lib().toggleFavorite(t);
    lib().createPlaylist({ name: 'Keep', tracks: [t] });
    lib().addSearch('daft');
    expect(await saveNow()).toBe(true);
    const raw = await kvGet('library');
    useLibrary.setState({ ...initialData() });
    expect(Object.keys(lib().favoriteTracks)).toHaveLength(0);
    useLibrary.getState().replaceData(normalizeLoaded(raw));
    expect(lib().favoriteTracks['jamendo:persist']).toBeTruthy();
    expect(lib().playlists[0].name).toBe('Keep');
    expect(lib().searches[0].q).toBe('daft');
  });
  it('drops corrupted entries instead of crashing', () => {
    const n = normalizeLoaded({ data: { favoriteTracks: { x: { item: { nope: true } } }, playlists: [{ id: 'p', name: 'ok', tracks: [{ track: 5 }] }], history: 'bad' } });
    expect(Object.keys(n.favoriteTracks)).toHaveLength(0);
    expect(n.playlists[0].tracks).toHaveLength(0);
    expect(n.history).toEqual([]);
  });
  it('round-trips an export and rejects foreign files', () => {
    lib().toggleFavorite(makeTrack({ providerTrackId: 'e1' }));
    lib().createPlaylist({ name: 'P', tracks: makeList(2) });
    const file = JSON.parse(JSON.stringify(exportLibrary()));
    useLibrary.setState({ ...initialData() });
    const r = importLibrary(file, { mode: 'replace' });
    expect(r.favorites).toBe(1);
    expect(lib().playlists[0].tracks).toHaveLength(2);
    expect(() => importLibrary({ hello: 1 })).toThrow(/not a DISC/);
  });
  it('records history, caps it, and clears it', () => {
    const t = makeTrack();
    lib().recordPlay({ track: t, listenedSec: 31 });
    expect(lib().history).toHaveLength(1);
    lib().clearHistory();
    expect(lib().history).toHaveLength(0);
  });
});

describe('library sorting and filtering', () => {
  const entries = [
    { item: makeTrack({ title: 'Beta', artists: [{ name: 'Zed' }] }), addedAt: 1 },
    { item: makeTrack({ title: 'Alpha', artists: [{ name: 'Yan' }] }), addedAt: 3 },
    { item: makeTrack({ title: 'Gamma', artists: [{ name: 'Xi' }], album: { title: 'Aardvark' } }), addedAt: 2 },
  ];
  it('sorts by date, title, artist, album without mutating', () => {
    expect(sortEntries(entries, 'added').map((e) => e.item.title)).toEqual(['Alpha', 'Gamma', 'Beta']);
    expect(sortEntries(entries, 'title').map((e) => e.item.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(sortEntries(entries, 'artist').map((e) => e.item.artists[0].name)).toEqual(['Xi', 'Yan', 'Zed']);
    expect(sortEntries(entries, 'album')[0].item.title).toBe('Gamma');
    expect(entries[0].item.title).toBe('Beta');
  });
  it('filters across title, artist and album', () => {
    expect(filterEntries(entries, 'yan')).toHaveLength(1);
    expect(filterEntries(entries, 'aardvark')).toHaveLength(1);
    expect(filterEntries(entries, '')).toHaveLength(3);
  });
});
