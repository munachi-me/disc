'use client';
import Link from 'next/link';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { fetchProviders } from '@/lib/client/api';

const NOTES = {
  itunes: 'Previews only (about 30 s). No key needed.',
  archive: 'Full tracks from Creative Commons / open-licensed items. No key needed.',
  jamendo: 'Full-length Creative Commons music. Needs a free JAMENDO_CLIENT_ID in .env.local.',
};

/** Explains which sources work right now and what each can play. */
export function SourcesCard({ compact = false }) {
  const { data, error, loading, retry } = useAsync((signal) => fetchProviders({ signal }), []);
  return (
    <section aria-label="Music sources" className="rounded-card border border-line bg-card p-4 md:p-5">
      <h2 className="text-base font-semibold">Where DISC finds music</h2>
      <p className="mt-1 text-sm text-muted">Each result is labelled <span className="text-fg">Full track</span>, <span className="text-fg">Preview clip</span> or <span className="text-fg">Unavailable</span>. DISC never presents a preview as a full recording.</p>
      {loading && <p className="mt-3 text-sm text-muted">Checking sources…</p>}
      {error && <p className="mt-3 text-sm text-muted">Couldn’t check sources. <button type="button" className="text-accent-bright underline" onClick={retry}>Retry</button></p>}
      {data && (
        <ul className="mt-3 space-y-2">
          {data.providers.map((p) => (
            <li key={p.id} className="flex items-start gap-2.5 text-sm">
              {p.configured ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent-bright" aria-label="Ready" /> : <CircleDashed size={16} className="mt-0.5 shrink-0 text-muted" aria-label="Needs setup" />}
              <span><span className="font-medium">{p.name}</span> <span className="text-muted">— {p.configured ? NOTES[p.id] : `not connected. ${NOTES[p.id]}`}</span></span>
            </li>
          ))}
        </ul>
      )}
      {!compact && <p className="mt-3 text-sm text-muted">You can also <Link href="/library" className="text-accent-bright hover:underline">import your own audio files</Link> and play them without any provider.</p>}
    </section>
  );
}
