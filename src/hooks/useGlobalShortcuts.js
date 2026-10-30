'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayer, useProgress } from '@/lib/player/playerStore';

const typing = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

/** "/" opens search, Space toggles play/pause, Shift+←/→ previous/next. Ignored while typing or on focused buttons/links. */
export function useGlobalShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const p = usePlayer.getState();
      if (e.key === '/') {
        e.preventDefault();
        if (location.pathname === '/search') document.getElementById('search-input')?.focus();
        else router.push('/search');
      } else if (e.key === ' ' && !['BUTTON', 'A', 'SUMMARY'].includes(e.target.tagName) && p.current()) {
        e.preventDefault();
        p.togglePlay();
      } else if (e.shiftKey && e.key === 'ArrowRight') p.next();
      else if (e.shiftKey && e.key === 'ArrowLeft') p.prev(useProgress.getState().currentTime);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}
