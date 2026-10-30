// Only these hosts (and their subdomains) are accepted for media and artwork coming from providers.
// This prevents a malformed or malicious provider response from making the player load arbitrary URLs.
const MEDIA_HOSTS = ['mzstatic.com', 'apple.com', 'jamendo.com', 'archive.org'];

function hostMatches(hostname, suffixes) {
  const h = hostname.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith(`.${s}`));
}

export function parseHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export function safeMediaUrl(value) {
  const u = parseHttpsUrl(value);
  return u && hostMatches(u.hostname, MEDIA_HOSTS) ? u.toString() : null;
}

export function safeImageUrl(value) {
  return safeMediaUrl(value);
}

/** Links that open an item on its original platform. */
export function safeExternalUrl(value) {
  return safeMediaUrl(value);
}

/** Internal paths only. Blocks protocol-relative and absolute URLs (open-redirect protection). */
export function safeInternalPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

/** Strip tags and control characters from untrusted provider text. React escapes output; this keeps stored text clean. */
export function cleanText(value, max = 500) {
  if (value == null) return '';
  const s = (Array.isArray(value) ? value.join(', ') : String(value))
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
