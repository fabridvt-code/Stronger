/**
 * Repository layer — the ONLY place that writes to the local DB (spec §34).
 *
 * Every write stamps SyncMeta and enqueues a SyncOperation, so the (Phase 2) sync
 * engine has a durable record of local changes. Reads may use Dexie liveQuery
 * directly (see src/lib/queries.ts) — only mutations must go through here.
 */

import type { Table } from 'dexie';
import { db, type SyncOperation } from './db';
import { uid, now } from './ids';
import type { SyncMeta, UserPreference } from '@/domain/types';
import { EXERCISE_SEED } from '@/domain/exercises/seed';

/** Local single-user identity until Supabase auth lands (Phase 2). */
export const LOCAL_USER_ID = 'local-user';

const SYNCED_ENTITIES = new Set([
  'programs', 'phases', 'weeks', 'workouts', 'workoutExercises', 'setTemplates',
  'sessions', 'completedSets', 'progressionRules', 'personalRecords', 'bodyMetrics',
  'preferences', 'exercises',
]);

/** Fresh SyncMeta for a brand-new row. */
export function newMeta(): SyncMeta {
  const t = now();
  return { id: uid(), createdAt: t, updatedAt: t, deletedAt: null, dirty: true, version: 1 };
}

async function enqueue(entity: string, entityId: string, op: 'upsert' | 'delete', payload: unknown) {
  if (!SYNCED_ENTITIES.has(entity)) return;
  const t = now();
  const operation: SyncOperation = {
    id: uid(),
    entity,
    entityId,
    op,
    payload,
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: t,
    updatedAt: t,
  };
  await db().syncQueue.add(operation);
}

/** Insert a new row (meta pre-stamped or generated) and enqueue for sync. */
export async function create<T extends SyncMeta>(
  entity: keyof typeof tableMap,
  data: Omit<T, keyof SyncMeta> & Partial<SyncMeta>,
): Promise<T> {
  const meta = { ...newMeta(), ...pickMeta(data) };
  const row = { ...(data as object), ...meta } as T;
  const table = tableFor(entity) as Table<T, string>;
  await table.put(row);
  await enqueue(entity, meta.id, 'upsert', row);
  return row;
}

/** Patch an existing row: bump version/updatedAt, mark dirty, enqueue. */
export async function update<T extends SyncMeta>(
  entity: keyof typeof tableMap,
  id: string,
  patch: Partial<T>,
): Promise<T | undefined> {
  const table = tableFor(entity) as Table<T, string>;
  const existing = await table.get(id);
  if (!existing) return undefined;
  const merged = {
    ...existing,
    ...patch,
    updatedAt: now(),
    version: existing.version + 1,
    dirty: true,
  } as T;
  await table.put(merged);
  await enqueue(entity as string, id, 'upsert', merged);
  return merged;
}

/** Soft-delete (tombstone) so deletes propagate and rows never resurrect. */
export async function remove(entity: keyof typeof tableMap, id: string): Promise<void> {
  const table = tableFor(entity);
  const existing = await table.get(id);
  if (!existing) return;
  const tombstoned = { ...existing, deletedAt: now(), updatedAt: now(), version: existing.version + 1, dirty: true };
  await table.put(tombstoned);
  await enqueue(entity as string, id, 'delete', tombstoned);
}

// --- table resolution ------------------------------------------------------

const tableMap = {
  exercises: () => db().exercises,
  programs: () => db().programs,
  phases: () => db().phases,
  weeks: () => db().weeks,
  workouts: () => db().workouts,
  workoutExercises: () => db().workoutExercises,
  setTemplates: () => db().setTemplates,
  sessions: () => db().sessions,
  completedSets: () => db().completedSets,
  progressionRules: () => db().progressionRules,
  personalRecords: () => db().personalRecords,
  bodyMetrics: () => db().bodyMetrics,
  preferences: () => db().preferences,
} as const;

function tableFor(entity: keyof typeof tableMap): Table<SyncMeta, string> {
  return tableMap[entity]() as unknown as Table<SyncMeta, string>;
}

function pickMeta(data: Partial<SyncMeta>): Partial<SyncMeta> {
  const meta: Partial<SyncMeta> = {};
  if (data.id) meta.id = data.id;
  if (data.createdAt) meta.createdAt = data.createdAt;
  return meta;
}

// --- bootstrap -------------------------------------------------------------

/** Seed the builtin exercise library on first run. Idempotent. */
export async function seedLibraryIfEmpty(): Promise<void> {
  const count = await db().exercises.count();
  if (count > 0) return;
  await db().exercises.bulkPut(EXERCISE_SEED);
  // Builtin library is not user data — not enqueued for sync.
}

const DEFAULT_PREFS: Omit<UserPreference, keyof SyncMeta> = {
  userId: LOCAL_USER_ID,
  effortSystem: 'rir',
  unit: 'kg',
  loadIncrement: 2.5,
  defaultRestSec: 120,
  restTimerSound: true,
  restTimerVibrate: true,
  theme: 'dark',
  preferredSubstitutions: {},
};

/** Ensure a preferences row exists; return it. */
export async function ensurePreferences(): Promise<UserPreference> {
  const existing = await db().preferences.get(LOCAL_USER_ID);
  if (existing) return existing;
  const t = now();
  const row: UserPreference = {
    ...DEFAULT_PREFS,
    id: LOCAL_USER_ID,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    version: 1,
    dirty: false,
  };
  await db().preferences.put(row);
  return row;
}

export async function updatePreferences(patch: Partial<UserPreference>): Promise<UserPreference> {
  await ensurePreferences();
  const updated = await update<UserPreference>('preferences', LOCAL_USER_ID, patch);
  return updated!;
}

/** One-shot bootstrap called on app start. */
export async function bootstrap(): Promise<void> {
  await seedLibraryIfEmpty();
  await ensurePreferences();
}
