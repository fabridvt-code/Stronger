'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Today', icon: '🏠' },
  { href: '/programs', label: 'Programs', icon: '🗂️' },
  { href: '/library', label: 'Library', icon: '📚' },
  { href: '/progress', label: 'Progress', icon: '📈' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function BottomNav() {
  const pathname = usePathname();
  // Hide the tab bar during a live workout so the execution screen is distraction-free.
  const hidden = pathname?.startsWith('/session/');
  if (hidden) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-base-border bg-base-surface/95 backdrop-blur pb-safe-b">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? 'text-brand' : 'text-text-faint'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
