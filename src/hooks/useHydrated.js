'use client';
import { useLibrary } from '@/lib/storage/libraryStore';

/** True once saved library data has been loaded from the browser. Use it to avoid flashing empty states. */
export function useHydrated() {
  return useLibrary((s) => s.hydrated);
}
