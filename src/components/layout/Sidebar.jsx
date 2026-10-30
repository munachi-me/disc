'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { NAV_ITEMS, isActive } from './nav';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-sidebar px-3 py-5 md:flex">
      <Link href="/" className="mb-7 px-3" aria-label="DISC home">
        <Logo size={30} />
      </Link>
      <nav aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-elevated text-fg' : 'text-muted hover:bg-card hover:text-fg'}`}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                  <Icon size={18} className={active ? 'text-accent-bright' : ''} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="mt-auto px-3 text-[11px] leading-relaxed text-muted">Your library lives in this browser. Nothing is synced to a server.</p>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="shrink-0 border-t border-line bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.filter((i) => i.mobile).map(({ href, label, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined} className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-fg' : 'text-muted'}`}>
                <Icon size={20} className={active ? 'text-accent-bright' : ''} aria-hidden="true" />
                <span className={active ? 'font-semibold' : ''}>{short || label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-bg/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
      <Link href="/" aria-label="DISC home">
        <Logo size={26} />
      </Link>
      <div className="flex items-center">
        <Link href="/favorites" className="icon-btn" aria-label="Favorites">
          <HeartIcon />
        </Link>
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
import { Heart, Settings as Gear } from 'lucide-react';
const HeartIcon = () => <Heart size={20} />;
const GearIcon = () => <Gear size={20} />;
