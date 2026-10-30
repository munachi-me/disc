import { Suspense } from 'react';
import { SearchClient } from './SearchClient';

export const metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
