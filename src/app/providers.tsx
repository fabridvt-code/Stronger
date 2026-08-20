'use client';

import { useEffect, useState } from 'react';
import { bootstrap } from '@/lib/repo';
import { SyncManager } from '@/components/SyncManager';

/**
 * Client bootstrap: seeds the library + preferences on first run, requests
 * persistent storage (guards against IndexedDB eviction — spec §12 risk #8),
 * and registers the service worker for offline + installability.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap();
      if (navigator.storage?.persist) {
        try {
          await navigator.storage.persist();
        } catch {
          /* best-effort */
        }
      }
      if (!cancelled) setReady(true);
    })();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline still works via IndexedDB even if SW registration fails */
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        <div className="animate-pulse text-sm">Loading your training data…</div>
      </div>
    );
  }
  return (
    <>
      <SyncManager />
      {children}
    </>
  );
}
