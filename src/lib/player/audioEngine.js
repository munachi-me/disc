// One <audio> element for the whole app. It lives outside React so navigation never resets playback.
let audio = null;

export function getAudio() {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
  }
  return audio;
}

export function seekTo(seconds) {
  const a = getAudio();
  if (!a || !Number.isFinite(seconds)) return;
  const max = Number.isFinite(a.duration) ? a.duration : seconds;
  a.currentTime = Math.min(Math.max(0, seconds), max);
}

export function __resetAudioForTests() {
  audio = null;
}

export function describeMediaError(err) {
  // MediaError codes: 1 aborted, 2 network, 3 decode, 4 src not supported
  switch (err?.code) {
    case 2:
      return 'The network connection dropped while loading this track.';
    case 3:
      return 'This audio file could not be decoded by your browser.';
    case 4:
      return 'This audio source is unavailable or its format is not supported. The link may have expired.';
    default:
      return 'This track could not be played.';
  }
}
