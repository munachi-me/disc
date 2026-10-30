'use client';
import { useState } from 'react';
import { LogoMark } from '@/components/Logo';

const PALETTE = [
  ['#2a1f4d', '#14111f'],
  ['#1f2a4d', '#11141f'],
  ['#3a1f4d', '#1a111f'],
  ['#1f3a4d', '#111a1f'],
  ['#4d1f3f', '#1f1119'],
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Cover art with an on-brand fallback for missing or broken images. */
export function Artwork({ src, alt = '', seed = '', className = '', rounded = 'rounded-lg', size = 24 }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;
  const [a, b] = PALETTE[hash(seed || alt) % PALETTE.length];
  return (
    <div className={`relative aspect-square overflow-hidden bg-card ${rounded} ${className}`}>
      {showImage ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />
      ) : (
        <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className="flex h-full w-full items-center justify-center text-white/40" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          <LogoMark size={size} />
        </div>
      )}
    </div>
  );
}
