import { filePut, fileGet, fileDelete } from '@/lib/storage/idb';
import { randomId } from '@/lib/utilities/ids';

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba', 'webm'];
export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

const stripExt = (n) => n.replace(/\.[^.]+$/, '');

/** Read ID3v2 text frames (title/artist/album) from an MP3 header. Returns {} when none found. */
export function readId3(buffer) {
  const v = new DataView(buffer);
  if (buffer.byteLength < 10 || v.getUint8(0) !== 0x49 || v.getUint8(1) !== 0x44 || v.getUint8(2) !== 0x33) return {};
  const version = v.getUint8(3);
  if (version < 3) return {};
  const size = (v.getUint8(6) << 21) | (v.getUint8(7) << 14) | (v.getUint8(8) << 7) | v.getUint8(9);
  const end = Math.min(buffer.byteLength, 10 + size);
  const out = {};
  let pos = 10;
  const bytes = new Uint8Array(buffer);
  while (pos + 10 < end) {
    const id = String.fromCharCode(...bytes.slice(pos, pos + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const fsize = version === 4 ? (v.getUint8(pos + 4) << 21) | (v.getUint8(pos + 5) << 14) | (v.getUint8(pos + 6) << 7) | v.getUint8(pos + 7) : v.getUint32(pos + 4);
    if (fsize <= 0 || pos + 10 + fsize > end) break;
    if (['TIT2', 'TPE1', 'TALB'].includes(id)) {
      const enc = bytes[pos + 10];
      const body = bytes.slice(pos + 11, pos + 10 + fsize);
      let text = '';
      try {
        text = new TextDecoder(enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1').decode(body);
      } catch {
        text = '';
      }
      text = text.replace(/\0/g, '').trim();
      if (text) out[id === 'TIT2' ? 'title' : id === 'TPE1' ? 'artist' : 'album'] = text;
    }
    pos += 10 + fsize;
  }
  return out;
}

export function isSupportedAudio(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.includes(ext);
}

function readDuration(file) {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    const done = (val) => {
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(val);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
    a.src = url;
  });
}

/** Store a user-selected audio file locally and return a track record. Throws a readable Error if unusable. */
export async function importAudioFile(file) {
  if (!isSupportedAudio(file)) throw new Error(`“${file.name}” is not a supported audio file.`);
  if (file.size > MAX_IMPORT_BYTES) throw new Error(`“${file.name}” is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  const probe = document.createElement('audio');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type && !probe.canPlayType(file.type) && ext !== 'mp3') throw new Error(`Your browser can’t play ${file.type} files (“${file.name}”).`);
  let tags = {};
  try {
    tags = readId3(await file.slice(0, 262144).arrayBuffer());
  } catch {
    tags = {};
  }
  const fileId = randomId('file');
  await filePut(fileId, file); // may throw if the browser is out of space
  const duration = await readDuration(file);
  return {
    id: `local:${fileId}`,
    provider: 'local',
    providerTrackId: fileId,
    title: tags.title || stripExt(file.name),
    artists: [{ name: tags.artist || 'Unknown artist' }],
    album: tags.album ? { title: tags.album } : null,
    duration,
    genres: [],
    attribution: 'Imported from your device',
    extra: { fileId, fileName: file.name, size: file.size },
  };
}

export async function getLocalFileUrl(track) {
  const blob = await fileGet(track.extra?.fileId || track.providerTrackId);
  if (!blob) throw new Error('The imported file is no longer stored in this browser. Remove it and import it again.');
  return URL.createObjectURL(blob);
}

export const deleteLocalFile = (track) => fileDelete(track.extra?.fileId || track.providerTrackId).catch(() => {});
