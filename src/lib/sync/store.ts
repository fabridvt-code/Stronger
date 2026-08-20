import { create } from 'zustand';
import type { AuthUser } from '../auth';
import type { SyncReport } from './engine';

interface SyncStore {
  user: AuthUser | null;
  configured: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  pending: number;
  lastReport: SyncReport | null;
  set: (patch: Partial<Omit<SyncStore, 'set'>>) => void;
}

export const useSyncStore = create<SyncStore>((setState) => ({
  user: null,
  configured: false,
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  pending: 0,
  lastReport: null,
  set: (patch) => setState(patch),
}));
