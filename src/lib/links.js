export const albumHref = (id) => `/album/${encodeURIComponent(id)}`;
export const playlistHref = (id) => `/playlists/${encodeURIComponent(id)}`;
/** Artists without their own page (e.g. Internet Archive creators) link to a search for the name. */
export const artistHref = (artist) => (artist?.id ? `/artist/${encodeURIComponent(artist.id)}` : `/search?q=${encodeURIComponent(artist?.name || '')}`);
