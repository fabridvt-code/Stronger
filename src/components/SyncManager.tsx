'use client';

import { useEffect } from 'react';
import { isCloudConfigured } from '@/lib/firebase';
import { currentUser, onAuthChange } from '@/lib/auth';
import { pendingCount } from '@/lib/sync/engine';
import { syncNow } from '@/lib/sync/run';
import { useSyncStore } from '@/lib/sync/store';

const INTERVAL_MS = 30_000;

/**
 * Mounts once (in Providers). When cloud sync is configured AND a user is signed in,
 * it drains the local queue and pulls remote changes: on mount, on reconnect, on a
 * 30s heartbeat. Fully inert when Supabase isn't configured — the app stays local.
 */
export function SyncManager() {
  const set = useSyncStore((s) => s.set);

  useEffect(() => {
    set({ configured: isCloudConfigured() });
    pendingCount().then((pending) => set({ pending }));
    if (!isCloudConfigured()) return;

    let active = true;
    currentUser().then((u) => {
      if (!active) return;
      set({ user: u });
      if (u) void syncNow();
    });
    const unsub = onAuthChange((u) => {
      set({ user: u });
      if (u) void syncNow();
    });

    const id = setInterval(() => void syncNow(), INTERVAL_MS);
    const onOnline = () => void syncNow();
    window.addEventListener('online', onOnline);

    return () => {
      active = false;
      unsub();
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [set]);

  return null;
}
