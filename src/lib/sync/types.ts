/**
 * Sync provider contract (spec §5, §25). The engine is provider-agnostic: a
 * MemoryProvider backs the tests today, a Supabase adapter drops in for Phase 2
 * without touching the engine or the UI.
 */

import type { SyncMeta } from '@/domain/types';
import type { SyncOperation } from '../db';

export interface RemoteChange {
  entity: string;
  row: SyncMeta & Record<string, unknown>;
}

export interface PushResult {
  /** Ids of the SyncOperations the server accepted (so we can mark them done). */
  acceptedOpIds: string[];
  /** Ops that failed, with a reason, so we can retry/backoff. */
  failed: { opId: string; error: string }[];
}

export interface PullResult {
  changes: RemoteChange[];
  /** New cursor to persist; the next pull asks for changes after this. */
  cursor: number;
}

export interface SyncProvider {
  push(ops: SyncOperation[]): Promise<PushResult>;
  pull(since: number): Promise<PullResult>;
}
