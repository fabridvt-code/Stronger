/**
 * Sync engine (spec §5, §25). Local-first: the queue is the source of pending
 * writes; the engine pushes them, pulls remote deltas, and merges with the
 * per-record-type conflict rules. Safe to call repeatedly; idempotent.
 *
 *   LOCAL CHANGE → IndexedDB → Sync Queue → (online) → push → pull → resolve → confirmed
 */

import { db } from '../db';
import type { SyncOperation } from '../db';
import { resolveRow, shouldApplyPerformed, type Row } from './conflict';
import type { SyncProvider } from './types';

const MAX_ATTEMPTS = 5;
const CURSOR_KEY = 'pullCursor';

/** Entity name → Dexie table. Mirrors the repository's table map. */
function tableByName(entity: string) {
  const map: Record<string, unknown> = {
    exercises: db().exercises,
    programs: db().programs,
    phases: db().phases,
    weeks: db().weeks,
    workouts: db().workouts,
    workoutExercises: db().workoutExercises,
    setTemplates: db().setTemplates,
    sessions: db().sessions,
    completedSets: db().completedSets,
    progressionRules: db().progressionRules,
    personalRecords: db().personalRecords,
    bodyMetrics: db().bodyMetrics,
    preferences: db().preferences,
  };
  return map[entity] as
    | { get(id: string): Promise<Row | undefined>; put(row: Row): Promise<unknown> }
    | undefined;
}

async function getCursor(): Promise<number> {
  const row = await db().syncState.get(CURSOR_KEY);
  return typeof row?.value === 'number' ? row.value : 0;
}
async function setCursor(value: number): Promise<void> {
  await db().syncState.put({ key: CURSOR_KEY, value });
}

export interface SyncReport {
  pushed: number;
  failed: number;
  pulled: number;
  conflicts: number;
  skippedOffline: boolean;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Run one full sync cycle. Returns a report; never throws for expected offline/
 * provider errors (they're recorded on the queue for retry).
 */
export async function runSync(provider: SyncProvider): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, failed: 0, pulled: 0, conflicts: 0, skippedOffline: false };
  if (!isOnline()) {
    report.skippedOffline = true;
    return report;
  }

  // --- PUSH -----------------------------------------------------------------
  const pending = (await db().syncQueue.where('status').equals('pending').toArray()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  if (pending.length > 0) {
    let result;
    try {
      result = await provider.push(pending);
    } catch (err) {
      // Whole push failed (e.g. network dropped mid-flight) → bump attempts, retry later.
      for (const op of pending) await bumpFailure(op, err instanceof Error ? err.message : 'push failed');
      report.failed += pending.length;
      result = null;
    }
    if (result) {
      const accepted = new Set(result.acceptedOpIds);
      for (const op of pending) {
        if (accepted.has(op.id)) {
          await db().syncQueue.update(op.id, { status: 'done', updatedAt: Date.now() });
          report.pushed++;
        }
      }
      for (const f of result.failed) {
        const op = pending.find((o) => o.id === f.opId);
        if (op) await bumpFailure(op, f.error);
        report.failed++;
      }
    }
  }

  // --- PULL -----------------------------------------------------------------
  const since = await getCursor();
  let pull;
  try {
    pull = await provider.pull(since);
  } catch {
    return report; // pull will be retried next cycle
  }

  for (const change of pull.changes) {
    const table = tableByName(change.entity);
    if (!table) continue;

    if (change.entity === 'completedSets') {
      // Append-only: apply only if we don't already have this event.
      const existing = await table.get(change.row.id);
      if (existing) continue; // same id already present
      const eventId = change.row.clientEventId as string | undefined;
      if (eventId) {
        const dupe = await db().completedSets.where('clientEventId').equals(eventId).count();
        if (!shouldApplyPerformed(new Set(dupe ? [eventId] : []), change.row)) continue;
      }
      await table.put({ ...change.row, dirty: false });
      report.pulled++;
      continue;
    }

    const local = await table.get(change.row.id);
    const { winner, changed, conflict } = resolveRow(local, change.row);
    if (conflict) report.conflicts++;
    if (changed) {
      await table.put(winner);
      report.pulled++;
    }
  }

  await setCursor(pull.cursor);
  return report;
}

async function bumpFailure(op: SyncOperation, error: string): Promise<void> {
  const attempts = op.attempts + 1;
  await db().syncQueue.update(op.id, {
    attempts,
    lastError: error,
    status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
    updatedAt: Date.now(),
  });
}

/** Count of writes still waiting to reach the server. */
export async function pendingCount(): Promise<number> {
  return db().syncQueue.where('status').equals('pending').count();
}
