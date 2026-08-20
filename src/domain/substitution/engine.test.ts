import { describe, it, expect } from 'vitest';
import { scoreSimilarity, findAlternatives, toPercent } from './engine';
import { EXERCISE_SEED_BY_ID, EXERCISE_SEED } from '../exercises/seed';

const byId = (id: string) => {
  const e = EXERCISE_SEED_BY_ID[id];
  if (!e) throw new Error(`missing seed ${id}`);
  return e;
};

describe('similarity scoring', () => {
  it('scores identical-pattern, same-muscle exercises highly', () => {
    const bench = byId('ex_bench_press');
    const dbBench = byId('ex_db_bench_press');
    const { score } = scoreSimilarity(bench, dbBench);
    expect(toPercent(score)).toBeGreaterThanOrEqual(80);
  });

  it('scores a machine version of the same movement above a different movement', () => {
    const bench = byId('ex_bench_press');
    const machine = scoreSimilarity(bench, byId('ex_chest_press_machine')).score;
    const curl = scoreSimilarity(bench, byId('ex_barbell_curl')).score;
    expect(machine).toBeGreaterThan(curl);
  });

  it('gives near-zero similarity to unrelated movements/muscles', () => {
    const bench = byId('ex_bench_press');
    const calf = byId('ex_standing_calf_raise');
    expect(toPercent(scoreSimilarity(bench, calf).score)).toBeLessThan(20);
  });

  it('rewards equipment overlap in the breakdown', () => {
    const bench = byId('ex_bench_press'); // barbell + bench
    const incline = byId('ex_incline_bb_press'); // barbell + bench
    const { breakdown } = scoreSimilarity(bench, incline);
    expect(breakdown.equipment).toBe(1);
  });

  it('penalises a large stability gap', () => {
    const bench = byId('ex_bench_press'); // stability 4
    const machine = byId('ex_chest_press_machine'); // stability 1
    const { breakdown } = scoreSimilarity(bench, machine);
    expect(breakdown.stability).toBeLessThan(0.6);
  });
});

describe('findAlternatives ranking + filtering', () => {
  it('ranks same-pattern chest presses at the top for the bench press', () => {
    const alts = findAlternatives(byId('ex_bench_press'), EXERCISE_SEED, {}, 5);
    expect(alts.length).toBeGreaterThan(0);
    // All top results should be horizontal push
    expect(alts.every((a) => a.exercise.movementPattern === 'horizontal_push')).toBe(true);
    // Descending order
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1]!.score).toBeGreaterThanOrEqual(alts[i]!.score);
    }
  });

  it('excludes the target exercise itself', () => {
    const alts = findAlternatives(byId('ex_bench_press'), EXERCISE_SEED);
    expect(alts.find((a) => a.exercise.id === 'ex_bench_press')).toBeUndefined();
  });

  it('filters by available equipment (dumbbell-only home gym)', () => {
    const alts = findAlternatives(byId('ex_bench_press'), EXERCISE_SEED, {
      availableEquipment: ['dumbbell', 'bench', 'bodyweight'],
    });
    // No candidate may require equipment outside the available set
    const allowed = new Set(['dumbbell', 'bench', 'bodyweight']);
    expect(alts.every((a) => a.exercise.equipment.every((e) => allowed.has(e)))).toBe(true);
    // Dumbbell bench press should be a suggested alternative
    expect(alts.find((a) => a.exercise.id === 'ex_db_bench_press')).toBeDefined();
  });

  it('respects the minimum similarity threshold', () => {
    const alts = findAlternatives(byId('ex_bench_press'), EXERCISE_SEED, {
      minSimilarity: 0.9,
    });
    expect(alts.every((a) => a.score >= 0.9)).toBe(true);
  });

  it('boosts a user-pinned preferred alternative', () => {
    const target = byId('ex_bench_press');
    const withoutPin = findAlternatives(target, EXERCISE_SEED, {}, 20);
    const cablePressRankBefore = withoutPin.findIndex((a) => a.exercise.id === 'ex_cable_chest_press');
    const withPin = findAlternatives(target, EXERCISE_SEED, {
      preferredIds: ['ex_cable_chest_press'],
    }, 20);
    const cablePressRankAfter = withPin.findIndex((a) => a.exercise.id === 'ex_cable_chest_press');
    expect(cablePressRankAfter).toBeLessThanOrEqual(cablePressRankBefore);
  });
});
