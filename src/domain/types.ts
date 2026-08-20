/**
 * Core domain types.
 *
 * Three record families, kept strictly separate (spec §33):
 *   PROGRAMMED  — the plan template (Program → Phase → Week → Workout → Exercise → SetTemplate)
 *   PERFORMED   — the append-only event log (WorkoutSession → CompletedSet)
 *   RECOMMENDED — derived, never stored as truth (ProgressionResult)
 */

import type {
  Difficulty,
  Equipment,
  ExerciseCategory,
  MovementPattern,
  Muscle,
  RomProfile,
  StabilityRating,
} from './values/taxonomy';
import type { EffortSystem, WeightUnit } from './values';

/** Metadata every syncable row carries. Enables local-first sync (spec §7). */
export interface SyncMeta {
  id: string; // client-generated uuid — stable across devices
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms — used for last-writer-wins on Programmed rows
  deletedAt: number | null; // soft-delete tombstone
  /** Local-only: pending push to server. Not sent over the wire as truth. */
  dirty?: boolean;
  /** Monotonic version bumped on each local edit; helps conflict detection. */
  version: number;
}

// ---------------------------------------------------------------------------
// EXERCISE LIBRARY
// ---------------------------------------------------------------------------

export interface Exercise extends SyncMeta {
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  difficulty: Difficulty;
  unilateral: boolean;
  stability: StabilityRating;
  romProfile: RomProfile;
  defaultRepRange: { min: number; max: number };
  defaultRestSec: number;
  instructions?: string;
  commonErrors?: string[];
  contraindications?: string[];
  videoUrl?: string;
  imageUrl?: string;
  /** True for the seeded library; false for user-created exercises. */
  builtin?: boolean;
}

// ---------------------------------------------------------------------------
// PROGRAMMED (the plan)
// ---------------------------------------------------------------------------

export type ProgramStatus = 'draft' | 'active' | 'archived';

export interface Program extends SyncMeta {
  userId: string;
  name: string;
  status: ProgramStatus;
  notes?: string;
  effortSystem: EffortSystem; // program-level default; user pref can override display
}

export interface TrainingPhase extends SyncMeta {
  programId: string;
  name: string; // e.g. "Accumulation", "Intensification", "Deload"
  order: number;
  isDeload: boolean;
}

export interface TrainingWeek extends SyncMeta {
  phaseId: string;
  weekNumber: number; // 1..52 within the program
  isDeload: boolean;
  note?: string;
}

/** A single training day within a week. A "rest day" is simply a week with no workout on that slot. */
export interface Workout extends SyncMeta {
  weekId: string;
  name: string; // e.g. "Push", "Lower A"
  dayOfWeek: number | null; // 0-6, or null if not calendar-bound
  order: number;
  note?: string;
}

export type SetType = 'warmup' | 'working' | 'dropset' | 'backoff' | 'amrap';

/** Groups exercises into supersets/circuits. Members share a groupId + groupType. */
export type GroupType = 'straight' | 'superset' | 'circuit';

export interface WorkoutExercise extends SyncMeta {
  workoutId: string;
  exerciseId: string;
  order: number;
  groupId: string | null; // exercises with same groupId are performed together
  groupType: GroupType;
  progressionRuleId: string | null;
  note?: string;
  /** Confidence + review flag when this came from AI import (spec §28). */
  needsReview?: boolean;
  importConfidence?: number; // 0..1
}

export interface SetTemplate extends SyncMeta {
  workoutExerciseId: string;
  setIndex: number; // 1-based within the exercise
  setType: SetType;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  targetLoad: number | null;
  targetPct1rm: number | null; // for percentage-based programming
  tempo: string | null; // e.g. "3-1-1-0"
  restSec: number | null;
}

// ---------------------------------------------------------------------------
// PERFORMED (the event log — append-only)
// ---------------------------------------------------------------------------

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WorkoutSession extends SyncMeta {
  userId: string;
  workoutId: string; // the programmed day this instantiates
  programId: string;
  startedAt: number;
  finishedAt: number | null;
  status: SessionStatus;
  note?: string;
}

/**
 * An immutable record of one performed set. Append-only: corrections are new
 * events, never in-place overwrites of history. Idempotent on `clientEventId`.
 */
export interface CompletedSet extends SyncMeta {
  sessionId: string;
  workoutExerciseId: string;
  exerciseId: string; // denormalised for fast history queries
  setTemplateId: string | null; // null for freestyle/extra sets
  setIndex: number;
  setType: SetType;
  actualLoad: number | null;
  actualReps: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  unit: WeightUnit;
  completedAt: number;
  note?: string;
  clientEventId: string; // idempotency key — prevents duplicate sets on retry
}

// ---------------------------------------------------------------------------
// PROGRESSION (rules = programmed; results = derived/recommended)
// ---------------------------------------------------------------------------

export type ProgressionStrategy =
  | 'double'
  | 'linear'
  | 'rir'
  | 'rpe'
  | 'percentage'
  | 'rep_target'
  | 'manual';

export interface ProgressionRule extends SyncMeta {
  strategy: ProgressionStrategy;
  /** Strategy-specific parameters (see progression engine). */
  params: Record<string, number | string | boolean>;
  loadIncrement: number; // in the user's unit
  unit: WeightUnit;
}

// ---------------------------------------------------------------------------
// ANCILLARY
// ---------------------------------------------------------------------------

export interface PersonalRecord extends SyncMeta {
  userId: string;
  exerciseId: string;
  kind: 'e1rm' | 'max_load' | 'rep_pr';
  value: number; // e1RM, or load, depending on kind
  reps: number | null;
  load: number | null;
  unit: WeightUnit;
  achievedAt: number;
  sessionId: string;
}

export interface BodyMetric extends SyncMeta {
  userId: string;
  kind: 'bodyweight' | 'bodyfat' | 'custom';
  label?: string;
  value: number;
  unit: string;
  measuredAt: number;
}

export interface UserPreference extends SyncMeta {
  userId: string;
  effortSystem: EffortSystem;
  unit: WeightUnit;
  loadIncrement: number;
  defaultRestSec: number;
  restTimerSound: boolean;
  restTimerVibrate: boolean;
  theme: 'dark' | 'light' | 'system';
  /** Remembered manual substitution choices, boosts future ranking (spec §7 UX). */
  preferredSubstitutions: Record<string, string[]>; // exerciseId -> [preferred alt ids]
}
