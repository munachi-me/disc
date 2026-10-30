'use client';
import { AlertTriangle, RotateCw } from 'lucide-react';

export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden="true" />;
}

export function CardSkeletons({ count = 6 }) {
  return (
    <div className="scroll-x" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-36 md:w-44">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-3 h-3 w-4/5" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RowSkeletons({ count = 6 }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-12 w-12 shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-accent-bright">
          <Icon size={22} />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message = error?.message || 'Please try again.';
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-red-500/30 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 text-red-300" size={24} />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-5" onClick={onRetry}>
          <RotateCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

/** Shown when some providers failed but others returned results. Never blocks the page. */
export function ProviderErrors({ errors = [], onRetry }) {
  if (!errors.length) return null;
  const real = errors.filter((e) => e.code !== 'credentials');
  const missing = errors.filter((e) => e.code === 'credentials');
  return (
    <div role="status" className="mb-4 space-y-1 rounded-lg border border-line bg-card px-4 py-3 text-sm text-muted">
      {real.map((e) => (
        <p key={e.provider}>
          <span className="font-medium text-fg">{e.name}</span> had a problem: {e.message}
        </p>
      ))}
      {missing.length > 0 && (
        <p>
          {missing.map((e) => e.name).join(', ')} {missing.length === 1 ? 'is' : 'are'} not connected. See Settings → Music sources.
        </p>
      )}
      {real.length > 0 && onRetry && (
        <button type="button" className="mt-1 inline-flex items-center gap-1.5 text-accent-bright underline-offset-2 hover:underline" onClick={onRetry}>
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
