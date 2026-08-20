import { describe, it, expect } from 'vitest';
import { estimate1RM, totalVolumeLoad, bestE1RM } from './metrics';
import { setsPerMuscle, weeklyConsistency, weekKey } from './volume';
import { EXERCISE_SEED_BY_ID } from '../exercises/seed';
import type { CompletedSet, Exercise } from '../types';

function set(over: Partial<CompletedSet>): CompletedSet {
  return {
    id: Math.random().toString(36),
    sessionId: 's1',
    workoutExerciseId: 'we1',
    exerciseId: 'ex_bench_press',
    setTemplateId: null,
    setIndex: 1,
    setType: 'working',
    actualLoad: 80,
    actualReps: 8,
    actualRir: 2,
    actualRpe: null,
    unit: 'kg',
    completedAt: Date.UTC(2026, 0, 5),
    clientEventId: Math.random().toString(36),
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    version: 1,
    ...over,
  };
}

describe('metrics', () => {
  it('Epley e1RM: 100x1 = 100, 100x10 ≈ 133.3', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)!).toBeCloseTo(133.33, 1);
    expect(estimate1RM(null, 5)).toBeNull();
    expect(estimate1RM(100, 0)).toBeNull();
  });

  it('volume load sums load*reps', () => {
    expect(totalVolumeLoad([set({ actualLoad: 100, actualReps: 5 }), set({ actualLoad: 50, actualReps: 10 })])).toBe(1000);
  });

  it('bestE1RM picks the top set', () => {
    const best = bestE1RM([set({ actualLoad: 80, actualReps: 8 }), set({ actualLoad: 100, actualReps: 3 })]);
    expect(best).toBeGreaterThan(100);
  });
});

describe('setsPerMuscle', () => {
  const lib = new Map<string, Exercise>(Object.entries(EXERCISE_SEED_BY_ID));

  it('weights primary muscles at 1.0 and secondary at 0.5', () => {
    // Bench press: primary chest, secondary anterior_deltoid + triceps.
    const result = setsPerMuscle([set({ exerciseId: 'ex_bench_press' })], lib);
    const chest = result.find((r) => r.muscle === 'chest');
    const triceps = result.find((r) => r.muscle === 'triceps');
    expect(chest?.sets).toBe(1);
    expect(triceps?.sets).toBe(0.5);
  });

  it('excludes warm-up sets', () => {
    const result = setsPerMuscle([set({ setType: 'warmup' })], lib);
    expect(result).toHaveLength(0);
  });

  it('accumulates across multiple sets', () => {
    const result = setsPerMuscle(
      [set({ exerciseId: 'ex_bench_press' }), set({ exerciseId: 'ex_bench_press' })],
      lib,
    );
    expect(result.find((r) => r.muscle === 'chest')?.sets).toBe(2);
  });
});

describe('weekly consistency', () => {
  it('buckets sessions by ISO week', () => {
    const starts = new Map([
      ['s1', Date.UTC(2026, 0, 5)], // Mon 2026-W02
      ['s2', Date.UTC(2026, 0, 12)], // Mon 2026-W03
    ]);
    const sets = [
      set({ sessionId: 's1', completedAt: Date.UTC(2026, 0, 5) }),
      set({ sessionId: 's1', completedAt: Date.UTC(2026, 0, 5) }),
      set({ sessionId: 's2', completedAt: Date.UTC(2026, 0, 12) }),
    ];
    const weeks = weeklyConsistency(sets, starts);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.sessions).toBe(1);
    expect(weeks[0]!.sets).toBe(2);
    expect(weeks[1]!.sessions).toBe(1);
  });

  it('weekKey is stable within the same week', () => {
    expect(weekKey(Date.UTC(2026, 0, 5))).toBe(weekKey(Date.UTC(2026, 0, 8)));
  });
});
