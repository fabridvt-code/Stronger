import { describe, it, expect } from 'vitest';
import { parseWorkoutText } from './parser';
import { EXERCISE_SEED } from '../exercises/seed';

describe('deterministic workout parser', () => {
  it('parses the canonical English push day', () => {
    const text = `Monday — Push
Bench Press 4x6-8 RIR 2
Incline Dumbbell Press 3x8-10
Lateral Raises 3x12-15
Triceps Pushdown 3x10-12`;
    const program = parseWorkoutText(text, EXERCISE_SEED);

    expect(program.days).toHaveLength(1);
    expect(program.days[0]!.name).toMatch(/push/i);
    const ex = program.days[0]!.exercises;
    expect(ex).toHaveLength(4);

    const bench = ex[0]!;
    expect(bench.matchedExerciseId).toBe('ex_bench_press');
    expect(bench.sets).toBe(4);
    expect(bench.repMin).toBe(6);
    expect(bench.repMax).toBe(8);
    expect(bench.targetRir).toBe(2);
    expect(bench.status).toBe('ok');
  });

  it('parses messy Italian input and matches via aliases', () => {
    const text = `Panca 4x6/8 RIR 2
Lat machine 3x10
alzate laterali 3x12-15
curl ai cavi 3x8-12`;
    const program = parseWorkoutText(text, EXERCISE_SEED);
    const ex = program.days[0]!.exercises;

    expect(ex[0]!.matchedExerciseId).toBe('ex_bench_press'); // Panca
    expect(ex[0]!.sets).toBe(4);
    expect(ex[0]!.repMin).toBe(6);
    expect(ex[0]!.repMax).toBe(8);

    expect(ex[1]!.matchedExerciseId).toBe('ex_lat_pulldown'); // Lat machine
    expect(ex[1]!.sets).toBe(3);
    expect(ex[1]!.repMin).toBe(10);
    expect(ex[1]!.repMax).toBe(10); // single rep target

    expect(ex[2]!.matchedExerciseId).toBe('ex_lateral_raise'); // alzate laterali
    expect(ex[3]!.matchedExerciseId).toBe('ex_cable_curl'); // curl ai cavi
  });

  it('flags an unknown exercise as NEEDS_REVIEW instead of inventing it', () => {
    const program = parseWorkoutText('Zercher Frankenstein Hold 3x10', EXERCISE_SEED);
    const ex = program.days[0]!.exercises[0]!;
    expect(ex.matchedExerciseId).toBeNull();
    expect(ex.status).toBe('needs_review');
    expect(ex.confidence).toBeLessThan(0.5);
  });

  it('does not invent sets/reps that were not written', () => {
    const program = parseWorkoutText('Bench Press', EXERCISE_SEED);
    const ex = program.days[0]!.exercises[0]!;
    expect(ex.sets).toBeNull();
    expect(ex.repMin).toBeNull();
    expect(ex.status).toBe('needs_review'); // missing structure
  });

  it('extracts RPE and rest when present', () => {
    const program = parseWorkoutText('Barbell Row 3x8 RPE 8 rest 120', EXERCISE_SEED);
    const ex = program.days[0]!.exercises[0]!;
    expect(ex.targetRpe).toBe(8);
    expect(ex.restSec).toBe(120);
  });

  it('groups everything under a default day when no header is given', () => {
    const program = parseWorkoutText('Bench Press 4x6-8\nBarbell Row 4x6-8', EXERCISE_SEED);
    expect(program.days).toHaveLength(1);
    expect(program.days[0]!.exercises).toHaveLength(2);
  });
});
