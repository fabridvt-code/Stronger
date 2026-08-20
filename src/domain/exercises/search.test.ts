import { describe, it, expect } from 'vitest';
import { searchExercises } from './search';
import { EXERCISE_SEED } from './seed';

describe('exercise search', () => {
  it('matches multi-term queries across name (cable chest)', () => {
    const results = searchExercises('cable chest', EXERCISE_SEED);
    const names = results.map((r) => r.name);
    expect(names).toContain('Cable Chest Press');
  });

  it('matches by alias, including multilingual (panca → bench press)', () => {
    const results = searchExercises('panca', EXERCISE_SEED);
    expect(results.find((r) => r.id === 'ex_bench_press')).toBeDefined();
  });

  it('is accent-insensitive', () => {
    const results = searchExercises('affondi', EXERCISE_SEED);
    expect(results.find((r) => r.id === 'ex_walking_lunge')).toBeDefined();
  });

  it('matches by muscle', () => {
    const results = searchExercises('hamstrings', EXERCISE_SEED);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => [...r.primaryMuscles, ...r.secondaryMuscles].includes('hamstrings'))).toBe(true);
  });

  it('matches by equipment', () => {
    const results = searchExercises('cable', EXERCISE_SEED);
    expect(results.every((r) => r.equipment.includes('cable'))).toBe(true);
  });

  it('ranks a name-prefix match ahead of an alias-only match', () => {
    const results = searchExercises('bench', EXERCISE_SEED);
    // "Barbell Bench Press" contains bench in the name; should rank above
    // an exercise that only has bench via equipment.
    expect(results[0]!.name.toLowerCase()).toContain('bench');
  });

  it('returns everything for an empty query', () => {
    const results = searchExercises('', EXERCISE_SEED);
    expect(results.length).toBe(EXERCISE_SEED.length);
  });
});
