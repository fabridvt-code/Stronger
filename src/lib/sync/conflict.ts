/**
 * Conflict resolution (spec §5, §7). Differentiated by record type:
 *
 *   - PERFORMED (completedSets): append-only, immutable. Deduped by clientEventId.
 *     Two devices can never "conflict" on a historical fact — they're distinct events.
 *   - PROGRAMMED / preferences / derived: last-writer-wins per row by `updatedAt`,
 *     with tombstone (deletedAt) awareness so a delete never resurrects.
 *
 * Pure functions — no DB, fully unit-tested.
 */

import type { SyncMeta } from '@/domain/types';

export type Row = SyncMeta & Record<string, unknown>;

/** True if `a` is a strictly newer write than `b`. Ties broken by version. */
function isNewer(a: Row, b: Row): boolean {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
  return a.version > b.version;
}

/**
 * Resolve one local/remote pair to the winning row.
 * Returns `{ winner, changed }` — `changed` is true when the local store must update.
 */
export function resolveRow(
  local: Row | undefined,
  remote: Row,
): { winner: Row; changed: boolean; conflict: boolean } {
  if (!local) return { winner: remote, changed: true, conflict: false };
  if (local.id !== remote.id) return { winner: local, changed: false, conflict: false };

  // Both sides touched the row since the last sync → a real conflict.
  const conflict = !!local.dirty && local.updatedAt !== remote.updatedAt;

  if (isNewer(remote, local)) {
    // Remote wins; drop the local dirty flag since we're accepting the server state.
    return { winner: { ...remote, dirty: false }, changed: true, conflict };
  }
  // Local wins (or equal) — keep local, still push it.
  return { winner: local, changed: false, conflict };
}

/**
 * Append-only merge for performed sets: a pulled set is applied only if we don't
 * already have that clientEventId. Prevents duplicate sets on ret/re-sync (spec §5).
 */
export function shouldApplyPerformed(
  existingByEventId: Set<string>,
  remote: Row,
): boolean {
  const eventId = remote.clientEventId as string | undefined;
  if (!eventId) return true;
  return !existingByEventId.has(eventId);
}
