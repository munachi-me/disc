'use client';
import { X } from 'lucide-react';
import { useToasts } from '@/lib/toastStore';

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-36 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-28">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full border px-4 py-2.5 text-sm shadow-xl animate-fade ${t.tone === 'error' ? 'border-red-500/40 bg-[#2a1517]' : 'border-line bg-elevated'}`}>
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss message" className="text-muted hover:text-fg" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
