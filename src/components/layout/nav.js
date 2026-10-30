import { Compass, Heart, History, Home, Library, ListMusic, Search, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home, mobile: true },
  { href: '/discover', label: 'Discover', icon: Compass, mobile: true },
  { href: '/search', label: 'Search', icon: Search, mobile: true },
  { href: '/library', label: 'Your Library', short: 'Library', icon: Library, mobile: true },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/history', label: 'Listening History', short: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
