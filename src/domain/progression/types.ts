import type { ProgressionStrategy, SetTemplate } from '../types';
import type { WeightUnit } from '../values';

/** One performed working set, reduced to what progression needs. */
export interface PerformedSet {
  load: number | null;
  reps: number | null;
  rir: number | null; // already normalised to RIR scale by the caller
  rpe: number | null;
  setType: string;
}

export interface ProgressionInput {
  strategy: ProgressionStrategy;
  params: Record<string, number | string | boolean>;
  loadIncrement: number;
  unit: WeightUnit;
  /** Programmed working-set templates for this exercise (the intended plan). */
  templates: SetTemplate[];
  /** The most recent session's performed sets for this exercise (may be empty). */
  lastSession: PerformedSet[];
  /** Optional: the session before last, for detecting sustained regressions. */
  priorSession?: PerformedSet[];
  /** Week context for percentage / rep-target progression. */
  weekNumber?: number;
  /** A tested or estimated 1RM, when the strategy needs one. */
  referenceMax?: number | null;
}

export type ProgressionDecision =
  | 'increase_load'
  | 'increase_reps'
  | 'hold'
  | 'decrease_load'
  | 'deload_suggested'
  | 'insufficient_data'
  | 'manual';

export interface ProgressionResult {
  decision: ProgressionDecision;
  /** Recommended load for next session (in `unit`), or null to keep programmed. */
  recommendedLoad: number | null;
  /** Recommended rep target for next session (top of range unless changing). */
  recommendedReps: { min: number; max: number } | null;
  /** Human-readable, conservative explanation (spec §34 — explain, don't hallucinate). */
  rationale: string;
  /** Non-blocking flags surfaced to the user (fatigue, effort mismatch). */
  flags: string[];
  /** True when the recommendation differs from the programmed template. */
  changed: boolean;
}
