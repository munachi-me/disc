export const SORTS = [
  ['added', 'Date added'],
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
];

const txt = (v) => String(v || '').toLowerCase();
const titleOf = (i) => txt(i.title || i.name);
const artistOf = (i) => txt(i.artists?.[0]?.name || i.name);
const albumOf = (i) => txt(i.album?.title || i.title || i.name);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Sort `{ item, addedAt }` entries without mutating the input. Ties fall back to date added (newest first). */
export function sortEntries(entries, sort = 'added') {
  const key = { title: titleOf, artist: artistOf, album: albumOf }[sort];
  return [...entries].sort((a, b) => (key ? cmp(key(a.item), key(b.item)) || b.addedAt - a.addedAt : b.addedAt - a.addedAt));
}

export function filterEntries(entries, query) {
  const q = txt(query).trim();
  if (!q) return entries;
  return entries.filter(({ item }) => [titleOf(item), artistOf(item), albumOf(item), txt((item.artists || []).map((a) => a.name).join(' '))].some((s) => s.includes(q)));
}
