import { fetchJson, ProviderError } from '@/lib/utilities/http';
import { cleanText } from '@/lib/utilities/url';

/**
 * Optional lyrics via Musixmatch (licensed API). Lyrics are never generated or scraped.
 * Free Musixmatch plans return only a portion of the lyrics; the response says so via `partial`.
 * NOTE: this adapter follows the public Musixmatch docs but has not been tested against the live API.
 */
export async function fetchLyrics({ title, artist }, { env = process.env, fetchImpl, signal } = {}) {
  const key = env.MUSIXMATCH_API_KEY;
  if (!key) throw new ProviderError('credentials', 'No lyrics provider is configured.', { provider: 'musixmatch' });
  const params = new URLSearchParams({ q_track: title, q_artist: artist, apikey: key, format: 'json' });
  const json = await fetchJson(`https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?${params}`, { fetchImpl, signal, provider: 'musixmatch' });
  const status = json?.message?.header?.status_code;
  if (status === 404) return { found: false };
  if (status !== 200 || !json?.message?.body?.lyrics) throw new ProviderError('http', 'The lyrics provider returned an error.', { provider: 'musixmatch', status });
  const l = json.message.body.lyrics;
  return {
    found: Boolean(l.lyrics_body),
    text: String(l.lyrics_body || '').replace(/\*{3,}.*$/s, '').trim().slice(0, 6000),
    partial: true,
    copyright: cleanText(l.lyrics_copyright, 300),
    attribution: 'Lyrics provided by Musixmatch',
  };
}

export function authorizedLyricsLink(title, artist) {
  return `https://genius.com/search?q=${encodeURIComponent(`${artist} ${title}`.slice(0, 150))}`;
}
