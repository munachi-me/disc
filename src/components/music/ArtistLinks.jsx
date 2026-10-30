import Link from 'next/link';
import { artistHref } from '@/lib/links';

export function ArtistLinks({ artists = [], className = '' }) {
  return (
    <span className={className}>
      {artists.map((a, i) => (
        <span key={`${a.id || a.name}-${i}`}>
          {i > 0 && ', '}
          <Link href={artistHref(a)} className="hover:text-fg hover:underline">
            {a.name}
          </Link>
        </span>
      ))}
    </span>
  );
}
