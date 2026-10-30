import { Suspense } from 'react';
import { DiscoverClient } from './DiscoverClient';

export const metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverClient />
    </Suspense>
  );
}
