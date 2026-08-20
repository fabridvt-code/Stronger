'use client';

import { getFirebase } from '../firebase';
import { runSync, pendingCount } from './engine';
import { FirestoreProvider } from './firestoreProvider';
import { useSyncStore } from './store';

let running = false;

/** Run one sync cycle against Firestore and update the shared status store. */
export async function syncNow(): Promise<void> {
  const fb = getFirebase();
  const { user, set } = useSyncStore.getState();
  if (!fb || !user || running) return;
  running = true;
  set({ syncing: true, lastError: null });
  try {
    const report = await runSync(new FirestoreProvider(fb));
    set({
      syncing: false,
      lastReport: report,
      lastSyncedAt: report.skippedOffline ? useSyncStore.getState().lastSyncedAt : Date.now(),
      pending: await pendingCount(),
    });
  } catch (err) {
    set({ syncing: false, lastError: err instanceof Error ? err.message : 'Sync failed.' });
  } finally {
    running = false;
  }
}
