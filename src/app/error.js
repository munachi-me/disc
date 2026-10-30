'use client';
import { ErrorState } from '@/components/ui/States';

export default function Error({ error, reset }) {
  return (
    <div className="page">
      <ErrorState error={error} onRetry={reset} title="This page hit a problem" />
    </div>
  );
}
