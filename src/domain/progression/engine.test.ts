import { describe, it, expect } from 'vitest';
import { evaluateProgression } from './engine';
import type { ProgressionInput, PerformedSet } from './types';
import type { SetTemplate } from '../types';

// --- helpers ---------------------------------------------------------------

function workingTemplate(
  overrides: Partial<SetTemplate> = {},
): SetTemplate {
  return {
    id: 't1',
    workoutExerciseId: 'we1',
    setIndex: 1,
    setType: 'working',
    repMin: 6,
    repMax: 8,
    targetRir: 2,
    targetRpe: null,
    targetLoad: 80,
    targetPct1rm: null,
    tempo: null,
    restSec: 150,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function perf(load: number, reps: number, rir: number | null = 2): PerformedSet {
  return { load, reps, rir, rpe: null, setType: 'working' };
}

function baseInput(overrides: Partial<ProgressionInput> = {}): ProgressionInput {
  return {
    strategy: 'double',
    params: {},
    loadIncrement: 2.5,
    unit: 'kg',
    templates: [workingTemplate()],
    lastSession: [],
    ...overrides,
  };
}

// --- DOUBLE PROGRESSION ----------------------------------------------------

describe('double progression', () => {
  it('increases load when all sets hit the top of the range at target RIR', () => {
    // 8/8/8 @ RIR 2 with range 6-8 → increase
    const res = evaluateProgression(
      baseInput({ lastSession: [perf(80, 8), perf(80, 8), perf(80, 8)] }),
    );
    expect(res.decision).toBe('increase_load');
    expect(res.recommendedLoad).toBe(82.5);
    expect(res.changed).toBe(true);
  });

  it('holds load and chases reps when sets are below the top of the range', () => {
    // 8/8/7 → not all at top → keep load, add reps
    const res = evaluateProgression(
      baseInput({ lastSession: [perf(80, 8), perf(80, 8), perf(80, 7)] }),
    );
    expect(res.decision).toBe('increase_reps');
    expect(res.recommendedLoad).toBe(80);
    expect(res.changed).toBe(false);
  });

  it('does not increase when reps are at top but effort was too hard (RIR 0)', () => {
    // 8/8/8 but at RIR 0 (harder than target 2) → should not jump load
    const res = evaluateProgression(
      baseInput({ lastSession: [perf(80, 8, 0), perf(80, 8, 0), perf(80, 8, 0)] }),
    );
    expect(res.decision).not.toBe('increase_load');
  });

  it('flags a regression when reps drop sharply at the same load vs prior session', () => {
    const res = evaluateProgression(
      baseInput({
        priorSession: [perf(80, 8), perf(80, 8), perf(80, 8)],
        lastSession: [perf(80, 6, 0), perf(80, 5, 0), perf(80, 4, 0)],
      }),
    );
    expect(res.flags.join(' ')).toMatch(/fatigue|recover/i);
  });

  it('returns insufficient_data with no performed sets', () => {
    const res = evaluateProgression(baseInput({ lastSession: [] }));
    expect(res.decision).toBe('insufficient_data');
  });
});

// --- LINEAR ----------------------------------------------------------------

describe('linear progression', () => {
  it('adds the increment when all sets meet the target reps', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'linear',
        templates: [workingTemplate({ repMin: 5, repMax: 5 })],
        lastSession: [perf(100, 5), perf(100, 5), perf(100, 5)],
      }),
    );
    expect(res.decision).toBe('increase_load');
    expect(res.recommendedLoad).toBe(102.5);
  });

  it('backs off ~10% on a failed session', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'linear',
        loadIncrement: 2.5,
        templates: [workingTemplate({ repMin: 5, repMax: 5 })],
        lastSession: [perf(100, 5), perf(100, 4), perf(100, 3)],
      }),
    );
    expect(res.decision).toBe('decrease_load');
    // 100 * 0.9 = 90, floored to 2.5 increment
    expect(res.recommendedLoad).toBe(90);
  });
});

// --- RIR / RPE -------------------------------------------------------------

describe('effort-based progression', () => {
  it('RIR: increases load when average effort is ≥2 RIR easier than target', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rir',
        templates: [workingTemplate({ targetRir: 2 })],
        lastSession: [perf(80, 8, 4), perf(80, 8, 4), perf(80, 8, 4)],
      }),
    );
    expect(res.decision).toBe('increase_load');
    expect(res.recommendedLoad).toBe(82.5);
  });

  it('RIR: holds when effort is on target', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rir',
        templates: [workingTemplate({ targetRir: 2 })],
        lastSession: [perf(80, 8, 2), perf(80, 8, 2)],
      }),
    );
    expect(res.decision).toBe('hold');
  });

  it('RIR: decreases load when effort overshoots (much harder than target)', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rir',
        templates: [workingTemplate({ targetRir: 3 })],
        lastSession: [perf(80, 6, 0), perf(80, 6, 0)],
      }),
    );
    expect(res.decision).toBe('decrease_load');
  });

  it('RPE: flags the recommendation as approximate', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rpe',
        templates: [workingTemplate({ targetRir: 2, targetRpe: 8 })],
        // rir here already normalised by caller; simulate very easy session
        lastSession: [perf(80, 8, 4), perf(80, 8, 4)],
      }),
    );
    expect(res.flags.join(' ')).toMatch(/approximate|estimate/i);
  });
});

// --- PERCENTAGE & REP TARGET ----------------------------------------------

describe('percentage progression', () => {
  it('computes load from reference max and programmed %, rounded to increment', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'percentage',
        referenceMax: 100,
        templates: [workingTemplate({ targetPct1rm: 82.5, repMin: 3, repMax: 5 })],
      }),
    );
    // 82.5% of 100 = 82.5, floors to 82.5 on a 2.5 increment
    expect(res.recommendedLoad).toBe(82.5);
  });
});

describe('rep-target progression', () => {
  it('advances the rep target by week', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rep_target',
        params: { startReps: 8, repsPerWeek: 1, repCap: 10 },
        weekNumber: 2,
        lastSession: [perf(60, 8)],
      }),
    );
    expect(res.decision).toBe('increase_reps');
    expect(res.recommendedReps).toEqual({ min: 9, max: 9 });
  });

  it('converts to a load increase once the rep cap is reached', () => {
    const res = evaluateProgression(
      baseInput({
        strategy: 'rep_target',
        params: { startReps: 8, repsPerWeek: 1, repCap: 10 },
        weekNumber: 3,
        lastSession: [perf(60, 10)],
      }),
    );
    expect(res.decision).toBe('increase_load');
    expect(res.recommendedLoad).toBe(62.5);
  });
});

// --- MANUAL ----------------------------------------------------------------

describe('manual progression', () => {
  it('never changes anything automatically', () => {
    const res = evaluateProgression(
      baseInput({ strategy: 'manual', lastSession: [perf(80, 8)] }),
    );
    expect(res.decision).toBe('manual');
    expect(res.changed).toBe(false);
  });
});
