/**
 * Workout execution + progression bridge (spec §19, §13, §33).
 *
 * Performed sets are written as an APPEND-ONLY log with idempotency keys. The
 * progression engine reads PROGRAMMED templates + PERFORMED history to produce
 * RECOMMENDED targets — never overwriting either.
 */

import { create, update, LOCAL_USER_ID } from './repo';
import { db } from './db';
import { uid } from './ids';
import { lastPerformed, workoutView } from './queries';
import { evaluateProgression } from '@/domain/progression/engine';
import type { PerformedSet, ProgressionResult } from '@/domain/progression/types';
import { estimate1RM } from '@/domain/analytics/metrics';
import { rpeToRir } from '@/domain/values/effort';
import type {
  CompletedSet,
  PersonalRecord,
  ProgressionRule,
  SetTemplate,
  Workout,
  WorkoutSession,
} from '@/domain/types';
import type { WeightUnit } from '@/domain/values';

export async function startSession(workout: Workout, programId: string): Promise<WorkoutSession> {
  return create<WorkoutSession>('sessions', {
    userId: LOCAL_USER_ID,
    workoutId: workout.id,
    programId,
    startedAt: Date.now(),
    finishedAt: null,
    status: 'in_progress',
  });
}

export interface LogSetInput {
  sessionId: string;
  workoutExerciseId: string;
  exerciseId: string;
  setTemplateId: string | null;
  setIndex: number;
  setType: CompletedSet['setType'];
  actualLoad: number | null;
  actualReps: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  unit: WeightUnit;
}

/** Append a performed set. Idempotent via clientEventId. */
export async function logSet(input: LogSetInput): Promise<CompletedSet> {
  return create<CompletedSet>('completedSets', {
    ...input,
    completedAt: Date.now(),
    clientEventId: uid('evt'),
  });
}

/** Correct a previously logged set (writes an update, not a silent overwrite of history). */
export async function amendSet(id: string, patch: Partial<CompletedSet>) {
  return update<CompletedSet>('completedSets', id, patch);
}

export async function finishSession(sessionId: string): Promise<void> {
  await update<WorkoutSession>('sessions', sessionId, {
    status: 'completed',
    finishedAt: Date.now(),
  });
  await detectPRs(sessionId);
}

export async function abandonSession(sessionId: string): Promise<void> {
  await update<WorkoutSession>('sessions', sessionId, { status: 'abandoned', finishedAt: Date.now() });
}

/** Detect estimated-1RM PRs from a finished session (spec §21). */
async function detectPRs(sessionId: string): Promise<void> {
  const sets = (await db().completedSets.where('sessionId').equals(sessionId).toArray()).filter(
    (s) => !s.deletedAt && s.setType !== 'warmup',
  );
  const byExercise = new Map<string, CompletedSet[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseId, arr);
  }

  for (const [exerciseId, list] of byExercise) {
    let bestE1rm = 0;
    let bestSet: CompletedSet | null = null;
    for (const s of list) {
      const e = estimate1RM(s.actualLoad, s.actualReps);
      if (e != null && e > bestE1rm) {
        bestE1rm = e;
        bestSet = s;
      }
    }
    if (!bestSet || bestE1rm <= 0) continue;

    const priorPRs = (await db().personalRecords.where('exerciseId').equals(exerciseId).toArray()).filter(
      (p) => !p.deletedAt && p.kind === 'e1rm',
    );
    const priorBest = priorPRs.reduce((m, p) => Math.max(m, p.value), 0);
    if (bestE1rm > priorBest + 0.01) {
      await create<PersonalRecord>('personalRecords', {
        userId: LOCAL_USER_ID,
        exerciseId,
        kind: 'e1rm',
        value: Math.round(bestE1rm * 10) / 10,
        reps: bestSet.actualReps,
        load: bestSet.actualLoad,
        unit: bestSet.unit,
        achievedAt: bestSet.completedAt,
        sessionId,
      });
    }
  }
}

/** Normalise a performed set to the RIR scale the progression engine expects. */
function toPerformed(s: CompletedSet): PerformedSet {
  const rir = s.actualRir != null ? s.actualRir : s.actualRpe != null ? rpeToRir(s.actualRpe) : null;
  return { load: s.actualLoad, reps: s.actualReps, rir, rpe: s.actualRpe, setType: s.setType };
}

export interface ExerciseRecommendation {
  workoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  result: ProgressionResult;
}

/**
 * Compute RECOMMENDED next targets for every exercise in a workout, using each
 * exercise's programmed templates + its most recent performed session.
 */
export async function recommendationsForWorkout(
  workoutId: string,
): Promise<ExerciseRecommendation[]> {
  const views = await workoutView(workoutId);
  const out: ExerciseRecommendation[] = [];

  for (const v of views) {
    const rule = v.workoutExercise.progressionRuleId
      ? await db().progressionRules.get(v.workoutExercise.progressionRuleId)
      : undefined;
    const performed = (await lastPerformed(v.workoutExercise.exerciseId)).map(toPerformed);

    const result = evaluateProgression({
      strategy: (rule?.strategy ?? 'double') as ProgressionRule['strategy'],
      params: rule?.params ?? {},
      loadIncrement: rule?.loadIncrement ?? 2.5,
      unit: rule?.unit ?? 'kg',
      templates: v.sets as SetTemplate[],
      lastSession: performed,
    });

    out.push({
      workoutExerciseId: v.workoutExercise.id,
      exerciseId: v.workoutExercise.exerciseId,
      exerciseName: v.exercise?.name ?? 'Exercise',
      result,
    });
  }
  return out;
}
