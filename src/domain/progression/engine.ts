/**
 * Progression engine (spec §9–§12).
 *
 * Pure and deterministic — NO AI in this path (spec §19). Every recommendation is
 * reproducible from the same inputs and errs conservative (spec §12).
 *
 * The engine reads PROGRAMMED templates + PERFORMED history and emits a RECOMMENDED
 * result. It never mutates either input.
 */

import { floorToIncrement } from '../values/load';
import type {
  PerformedSet,
  ProgressionInput,
  ProgressionResult,
} from './types';

// ---- shared helpers -------------------------------------------------------

const workingOnly = (sets: PerformedSet[]) =>
  sets.filter((s) => s.setType !== 'warmup' && s.reps != null);

function repRange(input: ProgressionInput): { min: number; max: number } | null {
  const t = input.templates.find((t) => t.setType === 'working') ?? input.templates[0];
  if (!t || t.repMin == null || t.repMax == null) return null;
  return { min: t.repMin, max: t.repMax };
}

function targetRir(input: ProgressionInput): number | null {
  const t = input.templates.find((t) => t.setType === 'working') ?? input.templates[0];
  return t?.targetRir ?? null;
}

function topLoad(sets: PerformedSet[]): number | null {
  return sets.reduce<number | null>(
    (max, s) => (s.load != null && (max == null || s.load > max) ? s.load : max),
    null,
  );
}

function avg(values: number[]): number | null {
  const nums = values.filter((v) => !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function increaseLoad(load: number, input: ProgressionInput): number {
  // Round DOWN on increase so we never over-prescribe.
  return floorToIncrement(load + input.loadIncrement, input.loadIncrement);
}

function insufficient(reason: string): ProgressionResult {
  return {
    decision: 'insufficient_data',
    recommendedLoad: null,
    recommendedReps: null,
    rationale: reason,
    flags: [],
    changed: false,
  };
}

// ---- strategies -----------------------------------------------------------

/**
 * DOUBLE PROGRESSION (default). Add reps within the range at fixed load; when all
 * working sets hit the top of the range at/above target RIR, add load & reset reps.
 */
function doubleProgression(input: ProgressionInput): ProgressionResult {
  const range = repRange(input);
  const sets = workingOnly(input.lastSession);
  if (!range) return insufficient('No rep range programmed for this exercise.');
  if (sets.length === 0) return insufficient('No performed sets logged yet.');

  const load = topLoad(sets);
  const tRir = targetRir(input);
  const allAtTop = sets.every((s) => (s.reps ?? 0) >= range.max);
  const effortOk =
    tRir == null || sets.every((s) => s.rir == null || s.rir >= tRir - 0.5);

  // Detect a clear regression vs the prior session (spec §9 fatigue case).
  const flags: string[] = [];
  if (input.priorSession) {
    const prev = workingOnly(input.priorSession);
    const prevTotal = prev.reduce((a, s) => a + (s.reps ?? 0), 0);
    const nowTotal = sets.reduce((a, s) => a + (s.reps ?? 0), 0);
    const sameLoad = topLoad(prev) === load;
    if (sameLoad && prevTotal - nowTotal >= 3) {
      flags.push(
        'Total reps dropped noticeably at the same load — possible accumulated fatigue or under-recovery.',
      );
    }
  }

  if (allAtTop && effortOk && load != null) {
    const next = increaseLoad(load, input);
    return {
      decision: 'increase_load',
      recommendedLoad: next,
      recommendedReps: { min: range.min, max: range.max },
      rationale: `All working sets reached ${range.max} reps at or above the target effort. Increase to ${next} ${input.unit} and rebuild from ${range.min} reps.`,
      flags,
      changed: true,
    };
  }

  // Below the top of the range but effort not maxed → keep load, chase reps.
  const belowFailure = sets.every((s) => s.rir == null || s.rir >= 1);
  if (belowFailure) {
    return {
      decision: 'increase_reps',
      recommendedLoad: load,
      recommendedReps: { min: range.min, max: range.max },
      rationale: `Keep ${load ?? 'the same'} ${input.unit} and aim to add reps toward ${range.max} on every set before increasing load.`,
      flags,
      changed: false,
    };
  }

  // Hitting failure (RIR 0) below the top of the range → the load may be too high.
  flags.push('Reached failure below the top of the rep range — load may be slightly high for the target effort.');
  return {
    decision: 'hold',
    recommendedLoad: load,
    recommendedReps: { min: range.min, max: range.max },
    rationale: `Hold ${load ?? 'the same'} ${input.unit}. Consolidate reps at this load before progressing.`,
    flags,
    changed: false,
  };
}

/**
 * LINEAR PROGRESSION. Add a fixed load each session while all programmed sets are
 * completed; on a failed/missed session, back off by a configurable percentage.
 */
function linearProgression(input: ProgressionInput): ProgressionResult {
  const sets = workingOnly(input.lastSession);
  const range = repRange(input);
  if (sets.length === 0) return insufficient('No performed sets logged yet.');
  const load = topLoad(sets);
  if (load == null) return insufficient('No load recorded on the last session.');

  const targetReps = range?.min ?? Number(input.params.targetReps ?? 5);
  const completedAll = sets.every((s) => (s.reps ?? 0) >= targetReps);

  if (completedAll) {
    const next = increaseLoad(load, input);
    return {
      decision: 'increase_load',
      recommendedLoad: next,
      recommendedReps: range,
      rationale: `All sets hit the target reps — linear progression to ${next} ${input.unit}.`,
      flags: [],
      changed: true,
    };
  }

  const backoffPct = Number(input.params.backoffPct ?? 0.9);
  const backoff = floorToIncrement(load * backoffPct, input.loadIncrement);
  return {
    decision: 'decrease_load',
    recommendedLoad: backoff,
    recommendedReps: range,
    rationale: `Missed the target reps — back off to ${backoff} ${input.unit} and rebuild.`,
    flags: ['A missed linear session usually means the ramp was too fast; rebuild conservatively.'],
    changed: true,
  };
}

/** Compare achieved effort (RIR) vs the programmed target and nudge load. */
function effortProgression(input: ProgressionInput, system: 'rir' | 'rpe'): ProgressionResult {
  const sets = workingOnly(input.lastSession);
  const range = repRange(input);
  if (sets.length === 0) return insufficient('No performed sets logged yet.');
  const load = topLoad(sets);
  const tRir = targetRir(input);
  if (load == null || tRir == null) {
    return insufficient('This strategy needs a target RIR/RPE and a recorded load.');
  }
  const achieved = avg(sets.map((s) => s.rir).filter((r): r is number => r != null));
  if (achieved == null) return insufficient('No effort (RIR/RPE) recorded last session.');

  const delta = achieved - tRir; // positive → easier than target (more reps in reserve)
  const label = system === 'rpe' ? 'RPE-based' : 'RIR-based';
  const note =
    system === 'rpe'
      ? ['RPE↔RIR conversion is an estimate; treat this recommendation as approximate.']
      : [];

  if (delta >= 2) {
    const next = increaseLoad(load, input);
    return {
      decision: 'increase_load',
      recommendedLoad: next,
      recommendedReps: range,
      rationale: `${label}: last session averaged ~${delta.toFixed(1)} RIR easier than target — increase to ${next} ${input.unit}.`,
      flags: note,
      changed: true,
    };
  }
  if (delta <= -1.5) {
    const backoff = floorToIncrement(load - input.loadIncrement, input.loadIncrement);
    return {
      decision: 'decrease_load',
      recommendedLoad: backoff,
      recommendedReps: range,
      rationale: `${label}: last session was harder than target (effort overshoot) — reduce to ${backoff} ${input.unit}.`,
      flags: [...note, 'Effort ran higher than programmed; a small reduction keeps quality high.'],
      changed: true,
    };
  }
  return {
    decision: 'hold',
    recommendedLoad: load,
    recommendedReps: range,
    rationale: `${label}: effort was on target — hold ${load} ${input.unit}.`,
    flags: note,
    changed: false,
  };
}

/** PERCENTAGE of a reference max, scheduled by week. Engine only rounds & schedules. */
function percentageProgression(input: ProgressionInput): ProgressionResult {
  const ref = input.referenceMax;
  const t = input.templates.find((t) => t.targetPct1rm != null);
  const pct = t?.targetPct1rm ?? Number(input.params.pct ?? 0);
  if (ref == null || !pct) {
    return insufficient('Percentage progression needs a reference 1RM and a programmed %.');
  }
  const load = floorToIncrement((ref * pct) / 100, input.loadIncrement);
  return {
    decision: 'increase_load',
    recommendedLoad: load,
    recommendedReps: repRange(input),
    rationale: `${pct}% of ${ref} ${input.unit} ≈ ${load} ${input.unit} (rounded to your plate increment).`,
    flags: [],
    changed: true,
  };
}

/** REP-TARGET: advance a target rep count per week, converting to load on the final week. */
function repTargetProgression(input: ProgressionInput): ProgressionResult {
  const range = repRange(input);
  const week = input.weekNumber ?? 1;
  const startReps = Number(input.params.startReps ?? range?.min ?? 8);
  const perWeek = Number(input.params.repsPerWeek ?? 1);
  const cap = Number(input.params.repCap ?? range?.max ?? startReps + 3);
  const target = Math.min(cap, startReps + perWeek * (week - 1));
  const sets = workingOnly(input.lastSession);
  const load = topLoad(sets);

  if (target >= cap) {
    const next = load != null ? increaseLoad(load, input) : null;
    return {
      decision: 'increase_load',
      recommendedLoad: next,
      recommendedReps: { min: startReps, max: startReps },
      rationale: `Rep target reached the cap (${cap}). Increase load${next != null ? ` to ${next} ${input.unit}` : ''} and reset reps to ${startReps}.`,
      flags: [],
      changed: true,
    };
  }
  return {
    decision: 'increase_reps',
    recommendedLoad: load,
    recommendedReps: { min: target, max: target },
    rationale: `Week ${week}: aim for ${target} reps at the same load.`,
    flags: [],
    changed: true,
  };
}

/** MANUAL: engine defers entirely to the coach/user. */
function manual(input: ProgressionInput): ProgressionResult {
  return {
    decision: 'manual',
    recommendedLoad: topLoad(workingOnly(input.lastSession)),
    recommendedReps: repRange(input),
    rationale: 'Manual progression — no automatic change. Set the next target yourself.',
    flags: [],
    changed: false,
  };
}

// ---- entry point ----------------------------------------------------------

export function evaluateProgression(input: ProgressionInput): ProgressionResult {
  switch (input.strategy) {
    case 'double':
      return doubleProgression(input);
    case 'linear':
      return linearProgression(input);
    case 'rir':
      return effortProgression(input, 'rir');
    case 'rpe':
      return effortProgression(input, 'rpe');
    case 'percentage':
      return percentageProgression(input);
    case 'rep_target':
      return repTargetProgression(input);
    case 'manual':
      return manual(input);
    default:
      return insufficient('Unknown progression strategy.');
  }
}
