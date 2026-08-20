/**
 * Read helpers over the local DB. Reads are safe to run directly against Dexie
 * (only writes need the repository/sync boundary). These compose the data the UI
 * needs and keep components thin.
 */

import { db } from './db';
import { LOCAL_USER_ID } from './repo';
import type {
  CompletedSet,
  Exercise,
  Program,
  SetTemplate,
  Workout,
  WorkoutExercise,
} from '@/domain/types';

export async function allExercises(): Promise<Exercise[]> {
  const rows = await db().exercises.toArray();
  return rows.filter((e) => !e.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return db().exercises.get(id);
}

export async function activeProgram(): Promise<Program | undefined> {
  const rows = await db().programs
    .where('userId')
    .equals(LOCAL_USER_ID)
    .toArray();
  return rows.find((p) => p.status === 'active' && !p.deletedAt);
}

export async function programsByStatus(): Promise<Program[]> {
  const rows = await db().programs.where('userId').equals(LOCAL_USER_ID).toArray();
  return rows.filter((p) => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface WorkoutExerciseView {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  sets: SetTemplate[];
}

/** Full editable view of a workout: exercises (ordered) + their set templates. */
export async function workoutView(workoutId: string): Promise<WorkoutExerciseView[]> {
  const wex = (await db().workoutExercises.where('workoutId').equals(workoutId).toArray())
    .filter((w) => !w.deletedAt)
    .sort((a, b) => a.order - b.order);
  const views: WorkoutExerciseView[] = [];
  for (const we of wex) {
    const exercise = await db().exercises.get(we.exerciseId);
    const sets = (await db().setTemplates.where('workoutExerciseId').equals(we.id).toArray())
      .filter((s) => !s.deletedAt)
      .sort((a, b) => a.setIndex - b.setIndex);
    views.push({ workoutExercise: we, exercise, sets });
  }
  return views;
}

export async function workoutsForProgram(programId: string): Promise<Workout[]> {
  const phases = (await db().phases.where('programId').equals(programId).toArray()).filter(
    (p) => !p.deletedAt,
  );
  const weeks = (
    await db().weeks.where('phaseId').anyOf(phases.map((p) => p.id)).toArray()
  ).filter((w) => !w.deletedAt);
  const workouts = (
    await db().workouts.where('weekId').anyOf(weeks.map((w) => w.id)).toArray()
  ).filter((w) => !w.deletedAt);
  return workouts.sort((a, b) => a.order - b.order);
}

/** All completed sets for one exercise, newest first (spec §21 history). */
export async function exerciseHistory(exerciseId: string): Promise<CompletedSet[]> {
  const rows = await db()
    .completedSets.where('exerciseId')
    .equals(exerciseId)
    .toArray();
  return rows.filter((s) => !s.deletedAt).sort((a, b) => b.completedAt - a.completedAt);
}

/** The most recent COMPLETED session's sets for an exercise (for progression). */
export async function lastPerformed(exerciseId: string): Promise<CompletedSet[]> {
  const history = await exerciseHistory(exerciseId);
  if (history.length === 0) return [];
  const bySession = new Map<string, CompletedSet[]>();
  for (const s of history) {
    const arr = bySession.get(s.sessionId) ?? [];
    arr.push(s);
    bySession.set(s.sessionId, arr);
  }
  // history is newest-first, so the first session encountered is the latest.
  const latestSessionId = history[0]!.sessionId;
  return (bySession.get(latestSessionId) ?? []).sort((a, b) => a.setIndex - b.setIndex);
}

export async function sessionSets(sessionId: string): Promise<CompletedSet[]> {
  const rows = await db().completedSets.where('sessionId').equals(sessionId).toArray();
  return rows.filter((s) => !s.deletedAt).sort((a, b) => a.completedAt - b.completedAt);
}

export async function pendingSyncCount(): Promise<number> {
  return db().syncQueue.where('status').equals('pending').count();
}
