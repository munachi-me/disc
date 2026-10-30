/** Entity ids look like "provider:providerId" so items from different catalogs never collide. */
export function makeEntityId(provider, providerId) {
  return `${provider}:${providerId}`;
}

export function splitEntityId(id) {
  if (typeof id !== 'string') return null;
  const i = id.indexOf(':');
  if (i < 1 || i === id.length - 1) return null;
  return { provider: id.slice(0, i), providerId: id.slice(i + 1) };
}

/** Lowercased, accent-stripped, punctuation-free text for cross-provider comparisons. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function artistKey(artist) {
  return normalizeText(typeof artist === 'string' ? artist : artist?.name);
}

/** Key used to spot the same recording offered by two providers. */
export function dedupeKey(track) {
  return `${normalizeText(track?.title)}|${artistKey(track?.artists?.[0])}`;
}

export function randomId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
