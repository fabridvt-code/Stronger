/**
 * Builder operations (spec §9, §23). Creates the PROGRAMMED structure
 * Program → Phase → Week → Workout → WorkoutExercise → SetTemplate, all through
 * the sync-aware repository. Also builds a program from a parsed import.
 */

import { create, update, remove, LOCAL_USER_ID } from './repo';
import { db } from './db';
import { uid } from './ids';
import type {
  Program,
  TrainingPhase,
  TrainingWeek,
  Workout,
  WorkoutExercise,
  SetTemplate,
  ProgressionRule,
  ProgressionStrategy,
} from '@/domain/types';
import type { ParsedProgram } from '@/domain/import/types';
import { EXERCISE_SEED_BY_ID } from '@/domain/exercises/seed';

/** Create a draft program with a single phase + week (the common starting point). */
export async function createProgram(name: string): Promise<Program> {
  const program = await create<Program>('programs', {
    userId: LOCAL_USER_ID,
    name: name.trim() || 'New Program',
    status: 'draft',
    effortSystem: 'rir',
  });
  const phase = await create<TrainingPhase>('phases', {
    programId: program.id,
    name: 'Block 1',
    order: 0,
    isDeload: false,
  });
  await create<TrainingWeek>('weeks', {
    phaseId: phase.id,
    weekNumber: 1,
    isDeload: false,
  });
  return program;
}

/** The first (or given) week of a program — MVP works within one week template. */
export async function firstWeek(programId: string): Promise<TrainingWeek | undefined> {
  const phases = (await db().phases.where('programId').equals(programId).toArray())
    .filter((p) => !p.deletedAt)
    .sort((a, b) => a.order - b.order);
  for (const phase of phases) {
    const weeks = (await db().weeks.where('phaseId').equals(phase.id).toArray())
      .filter((w) => !w.deletedAt)
      .sort((a, b) => a.weekNumber - b.weekNumber);
    if (weeks[0]) return weeks[0];
  }
  return undefined;
}

export async function addWorkout(weekId: string, name: string): Promise<Workout> {
  const existing = (await db().workouts.where('weekId').equals(weekId).toArray()).filter(
    (w) => !w.deletedAt,
  );
  return create<Workout>('workouts', {
    weekId,
    name: name.trim() || `Day ${existing.length + 1}`,
    dayOfWeek: null,
    order: existing.length,
  });
}

export async function renameWorkout(id: string, name: string) {
  return update<Workout>('workouts', id, { name });
}

export async function deleteWorkout(id: string) {
  const wex = await db().workoutExercises.where('workoutId').equals(id).toArray();
  for (const we of wex) await deleteWorkoutExercise(we.id);
  return remove('workouts', id);
}

/** Default progression rule for a newly added exercise (double progression). */
async function createDefaultRule(strategy: ProgressionStrategy = 'double'): Promise<ProgressionRule> {
  return create<ProgressionRule>('progressionRules', {
    strategy,
    params: {},
    loadIncrement: 2.5,
    unit: 'kg',
  });
}

/** Add an exercise to a workout, seeding sensible default working sets. */
export async function addExercise(
  workoutId: string,
  exerciseId: string,
  opts: { sets?: number; repMin?: number; repMax?: number; targetRir?: number | null; restSec?: number | null } = {},
): Promise<WorkoutExercise> {
  const lib = EXERCISE_SEED_BY_ID[exerciseId] ?? (await db().exercises.get(exerciseId));
  const existing = (await db().workoutExercises.where('workoutId').equals(workoutId).toArray()).filter(
    (w) => !w.deletedAt,
  );
  const rule = await createDefaultRule();

  const we = await create<WorkoutExercise>('workoutExercises', {
    workoutId,
    exerciseId,
    order: existing.length,
    groupId: null,
    groupType: 'straight',
    progressionRuleId: rule.id,
  });

  const setCount = opts.sets ?? 3;
  const repMin = opts.repMin ?? lib?.defaultRepRange.min ?? 8;
  const repMax = opts.repMax ?? lib?.defaultRepRange.max ?? 12;
  const rest = opts.restSec ?? lib?.defaultRestSec ?? 120;
  const rir = opts.targetRir ?? 2;

  for (let i = 1; i <= setCount; i++) {
    await create<SetTemplate>('setTemplates', {
      workoutExerciseId: we.id,
      setIndex: i,
      setType: 'working',
      repMin,
      repMax,
      targetRir: rir,
      targetRpe: null,
      targetLoad: null,
      targetPct1rm: null,
      tempo: null,
      restSec: rest,
    });
  }
  return we;
}

export async function deleteWorkoutExercise(id: string) {
  const sets = await db().setTemplates.where('workoutExerciseId').equals(id).toArray();
  for (const s of sets) await remove('setTemplates', s.id);
  return remove('workoutExercises', id);
}

export async function reorderExercises(workoutId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await update<WorkoutExercise>('workoutExercises', orderedIds[i]!, { order: i });
  }
}

export async function updateSet(id: string, patch: Partial<SetTemplate>) {
  return update<SetTemplate>('setTemplates', id, patch);
}

export async function addSet(workoutExerciseId: string): Promise<SetTemplate> {
  const sets = (await db().setTemplates.where('workoutExerciseId').equals(workoutExerciseId).toArray())
    .filter((s) => !s.deletedAt)
    .sort((a, b) => a.setIndex - b.setIndex);
  const last = sets[sets.length - 1];
  return create<SetTemplate>('setTemplates', {
    workoutExerciseId,
    setIndex: (last?.setIndex ?? 0) + 1,
    setType: 'working',
    repMin: last?.repMin ?? 8,
    repMax: last?.repMax ?? 12,
    targetRir: last?.targetRir ?? 2,
    targetRpe: null,
    targetLoad: last?.targetLoad ?? null,
    targetPct1rm: null,
    tempo: last?.tempo ?? null,
    restSec: last?.restSec ?? 120,
  });
}

export async function removeSet(id: string) {
  return remove('setTemplates', id);
}

/** Activate a program (spec §4): archive any other active program first. */
export async function activateProgram(programId: string) {
  const active = (await db().programs.where('userId').equals(LOCAL_USER_ID).toArray()).filter(
    (p) => p.status === 'active' && !p.deletedAt && p.id !== programId,
  );
  for (const p of active) await update<Program>('programs', p.id, { status: 'archived' });
  return update<Program>('programs', programId, { status: 'active' });
}

/** Build a full program from a reviewed import (spec §7). */
export async function createProgramFromParsed(parsed: ParsedProgram): Promise<Program> {
  const program = await createProgram(parsed.name);
  const week = await firstWeek(program.id);
  if (!week) return program;

  for (const day of parsed.days) {
    const workout = await addWorkout(week.id, day.name);
    for (const ex of day.exercises) {
      if (!ex.matchedExerciseId) continue; // skip unresolved rows (user should have fixed them)
      await addExercise(workout.id, ex.matchedExerciseId, {
        sets: ex.sets ?? 3,
        repMin: ex.repMin ?? undefined,
        repMax: ex.repMax ?? undefined,
        targetRir: ex.targetRir,
        restSec: ex.restSec,
      });
    }
  }
  return program;
}

/** Utility for the import review screen: add a user-created exercise on the fly. */
export async function createCustomExercise(name: string, movementPattern: string): Promise<string> {
  const id = uid('exu');
  await create('exercises', {
    id,
    name,
    aliases: [],
    category: 'accessory',
    movementPattern: movementPattern as never,
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    difficulty: 'intermediate',
    unilateral: false,
    stability: 3,
    romProfile: 'moderate',
    defaultRepRange: { min: 8, max: 12 },
    defaultRestSec: 120,
    builtin: false,
  } as never);
  return id;
}
