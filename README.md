# DISC

A local-first music discovery and streaming app built with Next.js (App Router), React, Tailwind CSS, Zustand and IndexedDB. Plain JavaScript with JSDoc (no TypeScript).

DISC searches several legitimate catalogs, plays what those catalogs allow, and keeps your library, playlists and listening history **in your browser**. Nothing is synced to a server.

🚀 Live Preview: [Disc](https://disc-beta-eight.vercel.app)

## Features

- **Persistent player** with play/pause, previous/next, seek, volume/mute, shuffle, repeat (off/all/one), queue (play next, add, remove, reorder, clear), expanded full-screen player, lyrics tab, keyboard shortcuts (`/` search, `Space` play/pause, `Shift+←/→` previous/next).
- **Honest playback labels**: every track is **Full track**, **Preview clip** (iTunes, ~30 s) or **Unavailable**. Previews are never presented as full recordings.
- **Unified search** across enabled providers, debounced, cancelled when superseded, cached, with recent searches and per-provider error reporting and retry.
- **Discover**: genres, moods, activities, regions, popular / recent / hidden gems (Jamendo), "Surprise me", curated collections generated from keyword searches.
- **Playlists**: create, rename, describe, cover image (upload, link or track artwork), add/remove/reorder, duplicate, favorite, delete with confirmation, play/shuffle/queue.
- **Library**: favorites, saved albums, followed artists, playlists, recently played, imported local audio, sorting (date added/title/artist/album) and filtering.
- **History and stats**: a play is counted only after real listening (30 s or half the track); stats are computed locally with a labelled date range.
- **Recommendations**: transparent rule-based engine (see below). Optional cold-start genre picks.
- **Artist and album pages** using only data the provider returns.
- **Local import**: audio files you own, stored in IndexedDB, never uploaded.
- **Settings**: accent colour, default volume, autoplay, shuffle, audio quality (Jamendo), explicit filter (where labelled), provider on/off and order, export/import library JSON, clear history/cache/all data.
- Responsive layout: sidebar + player on desktop; header, bottom navigation, mini-player and expanded player on mobile with safe-area handling.

## Routes

`/` Home · `/discover` · `/search` · `/library` · `/favorites` · `/playlists` · `/playlists/[id]` · `/artist/[id]` · `/album/[id]` · `/history` · `/settings`.
Server endpoints: `/api/music/{search,browse,artist,album,providers}` and `/api/lyrics`.

## Quick start

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/munachi-me/disc.git
npm install
npm run dev        # http://localhost:3000
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint |
| `npm test` | Vitest test suite (jsdom) |
| `npm run test:watch` | Tests in watch mode |

## Configuration

Copy `.env.example` to `.env.local`. **Everything is optional.** Keys are read server-side only and never sent to the browser. Restart the server after editing.

| Variable | Enables |
| --- | --- |
| `JAMENDO_CLIENT_ID` | Jamendo: full-length Creative Commons tracks, popular/new releases, hidden gems |
| `ITUNES_COUNTRY` | iTunes storefront (default `US`) |
| `MUSIXMATCH_API_KEY` | Lyrics (free plans return partial lyrics) |

### What works without any key

| Feature | Without keys |
| --- | --- |
| App, navigation, playlists, favorites, history, stats, settings, import/export | Works (local only) |
| iTunes search, artwork, 30 s previews | Works (needs internet) |
| Internet Archive albums (license-tagged items only), browse | Works (needs internet) |
| Local audio import and playback | Works |
| Jamendo, "Popular this week", "New releases", "Hidden gems" | Needs `JAMENDO_CLIENT_ID` |
| Lyrics | Needs `MUSIXMATCH_API_KEY`; otherwise shows an unavailable state with a link to Genius |

## Music providers and playback limits

- **iTunes Search API**: metadata, artwork and ~30 s previews only. No full streams.
- **Jamendo**: full-length streams of Creative Commons music. Attribution and license are shown in the player; respect each track's license and Jamendo's API terms.
- **Internet Archive**: not everything there is free to use. DISC only surfaces items that carry explicit license metadata and shows that license.
- DISC does not scrape sites, bypass DRM or extract protected streams. Media and artwork URLs must be `https` on an allow-listed provider host (`src/lib/utilities/url.js`).
- Browsers block autoplay until a user gesture; playback starts from a button press.
- There is no crossfade, no cloud sync and no accounts. Those settings are intentionally absent.

Add a provider by implementing the interface in `src/lib/music-providers/` (see `itunes.js`), registering it in `index.js`, and adding its media hosts to the allow-list.

## Recommendation algorithm

`src/lib/recommendations/engine.js` is rule-based, **not machine learning**.

1. **Profile**: weights per artist and genre from plays (decayed by recency, half-life 21 days, partial plays count 0.6), favorites (×2 plus bonus), followed artists, saved albums, playlist membership (small, no decay) and onboarding picks.
2. **Candidates**: real tracks fetched from enabled providers by top artists, top genres and a few "explore" genres. No tracks are invented.
3. **Score** = artist affinity + genre match + favorite similarity + novelty − penalties for tracks already played often, recently recommended, or skipped early. Every result carries human-readable reasons.
4. **Diversity**: duplicates (same title + artist) are dropped and each artist is capped per list.
5. **Daily Mix** is a deterministic seeded shuffle, stable within a day. Sections: Made for you, Daily Mix, Because you listened to…, Artists like your favorites, Rediscover, Explore beyond your usual taste.

"Recently popular among your favorites" is not implemented because the providers do not supply reliable data for it. The engine is modular so collaborative filtering or embeddings could replace the scorer later.

## Data and privacy

- Library, playlists, history, searches and settings: IndexedDB plus `localStorage` in your browser. Imported audio files: IndexedDB only; excluded from exports.
- Listening history is never transmitted. Search terms are sent to the enabled providers (via this app's server) to get results; lyrics lookups send the track title and artist to Musixmatch if configured (not sent for imported files).
- Third parties that receive requests: Apple (iTunes), Jamendo, Internet Archive, Musixmatch. Artwork and audio are loaded by your browser directly from provider CDNs.
- Browser storage can be cleared by the browser or the user; use Settings → Export library for a backup.
- Security: strict CSP and security headers (`next.config.mjs`), validated ids and URLs, no HTML injection of provider text, no generic fetch proxy.

## Project layout

```
src/app            routes and API route handlers
src/components     layout, player, music cards/rows, playlists, ui
src/hooks          audio controller, async data, recommendations, shortcuts
src/lib            music-providers, recommendations, storage, player, client api, utilities
src/data           genre / mood / region taxonomy
tests              Vitest suites
```

## Testing

`npm test` runs 83 tests in 6 files: queue logic, player store and audio controller (mocked media element), library/playlists/persistence/export-import, recommendations, providers (normalization, invalid JSON, network errors, timeouts, missing credentials, unavailable playback) and UI behaviour (navigation, mini/expanded player, queue dialog, search debounce, empty/error states, settings confirmations).

Not covered by automated tests (verify manually): real audio output in browsers, live provider responses (tests use mocked fetch), real touch/viewport layout (jsdom has no layout engine, so mobile checks assert structure and classes, not pixels), screen-reader behaviour.

## Deployment

Any Node host that runs Next.js 15 (`npm run build && npm start`), e.g. Vercel or a container. Set the optional env vars in the host's dashboard. Static export is not supported because the provider proxy uses route handlers.

## Troubleshooting

- *No results / "Could not reach the provider"*: check your internet connection; the server fetches providers. Retry from the message.
- *Jamendo shelves say "not connected"*: set `JAMENDO_CLIENT_ID` in `.env.local` and restart.
- *Nothing plays*: previews and streams need an https URL your browser can decode; try another track. Errors are shown in the player.
- *Library vanished*: site data was cleared or you are in a private window. Import a previous export.

## Known limitations

- Live provider integrations were not exercised against the real services during development (the build environment had no outbound access to them); they are covered by mocked tests only. Test with your own network and key.
- No accounts, sync, crossfade or public provider playlists. The playlist search tab searches your own playlists only.
- Playlist/queue reordering uses up/down buttons rather than drag-and-drop.
- Stored track URLs are not re-validated until played; a dead track shows an error when played.
- Genre metadata is sparse for some sources, which limits genre stats and recommendations.

## Future ideas

Optional accounts with server sync, drag-and-drop reordering, crossfade, collaborative-filtering recommendations, more licensed providers, PWA offline shell.

## Attribution

Music, artwork and metadata belong to their rights holders and are provided by the services named above. Follow each provider's terms and each track's license.
