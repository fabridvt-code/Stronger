/**
 * Local-first database (spec §5, §25). Dexie over IndexedDB.
 *
 * This is the single source of truth while offline. Every table mirrors a domain
 * entity plus SyncMeta. A `SyncOperation` queue records local mutations for the
 * (Phase 2) cloud push. The UI NEVER touches this directly — it goes through the
 * repository layer (src/lib/repo.ts), which keeps the sync boundary clean.
 */

import Dexie, { type Table } from 'dexie';
import type {
  BodyMetric,
  CompletedSet,
  Exercise,
  PersonalRecord,
  Program,
  ProgressionRule,
  SetTemplate,
  TrainingPhase,
  TrainingWeek,
  UserPreference,
  Workout,
  WorkoutExercise,
  WorkoutSession,
} from '@/domain/types';

export type SyncStatus = 'pending' | 'inflight' | 'done' | 'failed';

/** The explicit local sync queue (spec §24 SyncOperation, §25). */
export interface SyncOperation {
  id: string;
  entity: string; // table name
  entityId: string;
  op: 'upsert' | 'delete';
  payload: unknown; // snapshot to push
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Small key/value store for sync bookkeeping (pull cursor, etc.). */
export interface SyncState {
  key: string;
  value: number | string;
}

export class StrongerDB extends Dexie {
  exercises!: Table<Exercise, string>;
  programs!: Table<Program, string>;
  phases!: Table<TrainingPhase, string>;
  weeks!: Table<TrainingWeek, string>;
  workouts!: Table<Workout, string>;
  workoutExercises!: Table<WorkoutExercise, string>;
  setTemplates!: Table<SetTemplate, string>;
  sessions!: Table<WorkoutSession, string>;
  completedSets!: Table<CompletedSet, string>;
  progressionRules!: Table<ProgressionRule, string>;
  personalRecords!: Table<PersonalRecord, string>;
  bodyMetrics!: Table<BodyMetric, string>;
  preferences!: Table<UserPreference, string>;
  syncQueue!: Table<SyncOperation, string>;
  syncState!: Table<SyncState, string>;

  constructor() {
    super('stronger');
    // v1 schema. Indexes chosen for the hot paths (spec §24):
    //   history by exercise+time, active program lookup, delta sync by updatedAt.
    this.version(1).stores({
      exercises: 'id, name, movementPattern, difficulty, builtin, updatedAt',
      programs: 'id, userId, status, updatedAt',
      phases: 'id, programId, order, updatedAt',
      weeks: 'id, phaseId, weekNumber, updatedAt',
      workouts: 'id, weekId, order, updatedAt',
      workoutExercises: 'id, workoutId, order, exerciseId, updatedAt',
      setTemplates: 'id, workoutExerciseId, setIndex, updatedAt',
      sessions: 'id, userId, workoutId, programId, status, startedAt, updatedAt',
      completedSets: 'id, sessionId, exerciseId, [exerciseId+completedAt], workoutExerciseId, updatedAt',
      progressionRules: 'id, updatedAt',
      personalRecords: 'id, userId, exerciseId, kind, updatedAt',
      bodyMetrics: 'id, userId, kind, measuredAt, updatedAt',
      preferences: 'id, userId',
      syncQueue: 'id, status, entity, createdAt',
    });
    // v2: add the sync bookkeeping store (additive migration — no data loss).
    this.version(2).stores({
      syncState: 'key',
    });
  }
}

let _db: StrongerDB | null = null;

/** Lazily construct the DB (only in the browser — IndexedDB is client-side). */
export function db(): StrongerDB {
  if (!_db) _db = new StrongerDB();
  return _db;
}
