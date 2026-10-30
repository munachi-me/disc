import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Logo size={40} withWordmark={false} className="mb-5 text-muted" />
      <h1 className="page-title">Nothing here</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">That page doesn’t exist. It may have moved, or the link may be mistyped.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/search" className="btn-secondary">Search music</Link>
      </div>
    </div>
  );
}
