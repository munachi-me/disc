import { describe, expect, it, vi } from 'vitest';
import { itunes, normalizeItunesTrack } from '@/lib/music-providers/itunes';
import { jamendo, normalizeJamendoTrack } from '@/lib/music-providers/jamendo';
import { archive, normalizeArchiveAlbum, normalizeArchiveItem } from '@/lib/music-providers/archive';
import { searchAll, describeProviders } from '@/lib/music-providers';
import { fetchJson, ProviderError } from '@/lib/utilities/http';
import { fetchLyrics } from '@/lib/music-providers/lyrics';
import { createTrack } from '@/lib/music-providers/model';
import { jsonResponse } from './helpers';

const ITUNES_SONG = { wrapperType: 'track', kind: 'song', trackId: 11, trackName: 'Song', artistName: 'Band', artistId: 7, collectionId: 3, collectionName: 'LP', artworkUrl100: 'https://is1.mzstatic.com/a/100x100bb.jpg', previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a', trackTimeMillis: 215000, primaryGenreName: 'Rock', trackExplicitness: 'explicit' };

describe('normalization', () => {
  it('iTunes results are previews, never full streams', () => {
    const t = normalizeItunesTrack(ITUNES_SONG);
    expect(t.id).toBe('itunes:11');
    expect(t.playbackType).toBe('preview');
    expect(t.streamUrl).toBeNull();
    expect(t.isPlayable).toBe(true);
    expect(t.playabilityReason).toMatch(/preview/i);
    expect(t.explicit).toBe(true);
    expect(t.artworkUrl).toContain('600x600');
    expect(t.duration).toBeCloseTo(215);
  });
  it('an iTunes song without a preview is unavailable, with a reason', () => {
    const t = normalizeItunesTrack({ ...ITUNES_SONG, previewUrl: undefined });
    expect(t.playbackType).toBe('none');
    expect(t.isPlayable).toBe(false);
    expect(t.playabilityReason).toBeTruthy();
  });
  it('Jamendo tracks with a stream are full; without one they are unavailable', () => {
    const base = { id: 5, name: 'N', artist_name: 'A', artist_id: 1, duration: 100, license_ccurl: 'https://creativecommons.org/licenses/by/4.0/' };
    const full = normalizeJamendoTrack({ ...base, audio: 'https://prod-1.storage.jamendo.com/?trackid=5' });
    expect(full.playbackType).toBe('full');
    expect(full.license).toContain('creativecommons');
    expect(full.attribution).toMatch(/Jamendo/);
    expect(normalizeJamendoTrack(base).playbackType).toBe('none');
  });
  it('rejects unsafe or malformed URLs and records', () => {
    expect(createTrack({ provider: 'x', providerTrackId: '1', title: 'T', streamUrl: 'http://insecure.example.com/a.mp3' }).isPlayable).toBe(false);
    expect(createTrack({ provider: 'x', providerTrackId: '1', title: 'T', streamUrl: 'javascript:alert(1)' }).streamUrl).toBeNull();
    expect(createTrack({ provider: 'x', title: 'T' })).toBeNull();
    expect(createTrack({ provider: 'x', providerTrackId: '1', title: '   ' })).toBeNull();
    expect(createTrack({ provider: 'x', providerTrackId: '1', title: '<b>Hi</b>' }).title).toBe('Hi');
  });
  it('Internet Archive items without license metadata are not surfaced as free', () => {
    expect(normalizeArchiveAlbum({ identifier: 'abc', title: 'T' })).toBeNull();
    expect(normalizeArchiveAlbum({ identifier: 'abc', title: 'T', licenseurl: 'https://creativecommons.org/licenses/by/4.0/' })).toBeTruthy();
    expect(() => normalizeArchiveItem({ metadata: { identifier: 'abc', title: 'T' }, files: [] })).toThrow(/license/i);
    expect(() => normalizeArchiveItem({})).toThrow(ProviderError);
  });
  it('Internet Archive builds playable full tracks from audio files', () => {
    const item = normalizeArchiveItem({
      metadata: { identifier: 'abc', title: 'Album', creator: 'Maker', licenseurl: 'https://creativecommons.org/licenses/by/4.0/' },
      files: [{ name: 'one.mp3', format: 'VBR MP3', title: 'One', length: '3:05', track: '1' }, { name: 'cover.jpg', format: 'JPEG' }],
    });
    expect(item.tracks).toHaveLength(1);
    expect(item.tracks[0].playbackType).toBe('full');
    expect(item.tracks[0].streamUrl).toMatch(/^https:\/\/archive\.org\/download\/abc\//);
    expect(item.tracks[0].duration).toBe(185);
  });
});

describe('provider requests', () => {
  it('iTunes search normalizes a mocked response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ results: [ITUNES_SONG, { wrapperType: 'track', kind: 'feature-movie' }] }));
    const r = await itunes.search({ query: 'band', types: ['tracks'], limit: 5 }, { fetchImpl, env: {} });
    expect(r.tracks).toHaveLength(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('itunes.apple.com/search');
  });
  it('invalid responses raise a typed error', async () => {
    const fetchImpl = async () => jsonResponse({ unexpected: true });
    await expect(itunes.search({ query: 'x', types: ['tracks'] }, { fetchImpl, env: {} })).rejects.toMatchObject({ code: 'invalid' });
  });
  it('HTTP errors, network errors and bad JSON map to codes', async () => {
    await expect(fetchJson('https://x.test', { fetchImpl: async () => jsonResponse({}, { status: 503 }) })).rejects.toMatchObject({ code: 'http', status: 503 });
    await expect(fetchJson('https://x.test', { fetchImpl: async () => { throw new TypeError('fail'); } })).rejects.toMatchObject({ code: 'network' });
    await expect(fetchJson('https://x.test', { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('bad'); } }) })).rejects.toMatchObject({ code: 'invalid' });
  });
  it('times out slow providers', async () => {
    const fetchImpl = (_u, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('a'), { name: 'AbortError' }))));
    await expect(fetchJson('https://x.test', { fetchImpl, timeoutMs: 20 })).rejects.toMatchObject({ code: 'timeout' });
  });
  it('a caller abort is reported as aborted, not as a failure', async () => {
    const c = new AbortController();
    const fetchImpl = (_u, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('a'), { name: 'AbortError' }))));
    const p = fetchJson('https://x.test', { fetchImpl, signal: c.signal, timeoutMs: 5000 });
    c.abort();
    await expect(p).rejects.toMatchObject({ code: 'aborted' });
  });
  it('Jamendo reports missing credentials instead of crashing', () => {
    expect(jamendo.isConfigured({})).toBe(false);
    expect(jamendo.isConfigured({ JAMENDO_CLIENT_ID: 'abc' })).toBe(true);
    expect(describeProviders({}).find((p) => p.id === 'jamendo').configured).toBe(false);
  });
  it('unified search keeps working when one provider fails or is unconfigured', async () => {
    const good = async () => jsonResponse({ results: [ITUNES_SONG] });
    const failing = vi.spyOn(archive, 'search').mockRejectedValue(new ProviderError('network', 'down', { provider: 'archive' }));
    const r = await searchAll({ query: 'unique-q-1', types: ['tracks'] }, { env: {}, fetchImpl: good });
    failing.mockRestore();
    expect(r.tracks.length).toBeGreaterThan(0);
    expect(r.tracks[0].provider).toBe('itunes');
    const codes = Object.fromEntries(r.errors.map((e) => [e.provider, e.code]));
    expect(codes.jamendo).toBe('credentials');
    expect(codes.archive).toBe('network');
  });
  it('lyrics: no key means a clear credentials error and no invented text', async () => {
    await expect(fetchLyrics({ title: 'a', artist: 'b' }, { env: {} })).rejects.toMatchObject({ code: 'credentials' });
  });
  it('lyrics: normalizes a mocked Musixmatch response and flags partial lyrics', async () => {
    const fetchImpl = async () => jsonResponse({ message: { header: { status_code: 200 }, body: { lyrics: { lyrics_body: 'la la\n\n*******', lyrics_copyright: '© someone' } } } });
    const r = await fetchLyrics({ title: 'a', artist: 'b' }, { env: { MUSIXMATCH_API_KEY: 'k' }, fetchImpl });
    expect(r).toMatchObject({ found: true, partial: true });
    expect(r.text).not.toMatch(/\*{3}/);
  });
});
