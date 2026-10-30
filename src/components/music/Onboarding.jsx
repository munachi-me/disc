'use client';
import { useState } from 'react';
import { GENRES } from '@/data/taxonomy';
import { useLibrary } from '@/lib/storage/libraryStore';

/** Optional cold-start step: pick a few genres so Home can personalise before any listening exists. */
export function Onboarding() {
  const [picked, setPicked] = useState([]);
  const setOnboarding = useLibrary((s) => s.setOnboarding);
  const toggle = (label) => setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label].slice(0, 6)));
  return (
    <section aria-labelledby="ob-title" className="rounded-card border border-line bg-card p-4 md:p-5">
      <h2 id="ob-title" className="text-base font-semibold">What do you like to hear?</h2>
      <p className="mt-1 text-sm text-muted">Pick up to six genres to seed your recommendations, or skip. Your picks stay in this browser.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={picked.includes(g.label)} onClick={() => toggle(g.label)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" disabled={!picked.length} onClick={() => setOnboarding({ done: true, genres: picked })}>Save picks</button>
        <button type="button" className="btn-ghost" onClick={() => setOnboarding({ done: true })}>Skip for now</button>
      </div>
    </section>
  );
}
