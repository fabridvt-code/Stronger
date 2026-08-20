/**
 * Effort model: RIR (Reps In Reserve) and RPE (Rate of Perceived Exertion).
 *
 * IMPORTANT (spec §11): the conversion between the two is an ESTIMATE, not a fact.
 * We store whatever the user actually logged and never silently convert one into
 * the other for storage. Conversion exists only for display and for engines that
 * need a common scale, and it is always flagged as approximate.
 */

export type EffortSystem = 'rir' | 'rpe';

/** RIR is clamped to a sane training range (0 = failure, 5 = very easy). */
export const RIR_MIN = 0;
export const RIR_MAX = 5;

/** RPE for resistance training is meaningful roughly in [5, 10]. */
export const RPE_MIN = 5;
export const RPE_MAX = 10;

export function clampRir(value: number): number {
  return Math.min(RIR_MAX, Math.max(RIR_MIN, value));
}

export function clampRpe(value: number): number {
  return Math.min(RPE_MAX, Math.max(RPE_MIN, value));
}

/**
 * Approximate mapping (spec §11):
 *   RIR 4 ≈ RPE 6, RIR 3 ≈ RPE 7, RIR 2 ≈ RPE 8, RIR 1 ≈ RPE 9, RIR 0 ≈ RPE 10.
 * Linear relation: RPE = 10 - RIR (for RIR in [0,5] → RPE in [5,10]).
 */
export function rirToRpe(rir: number): number {
  return clampRpe(10 - clampRir(rir));
}

export function rpeToRir(rpe: number): number {
  return clampRir(10 - clampRpe(rpe));
}

/**
 * Normalise any logged effort to a common RIR scale so engines can compare.
 * The `approximate` flag is true whenever a conversion happened.
 */
export function toRir(
  value: number | null | undefined,
  system: EffortSystem,
): { rir: number; approximate: boolean } | null {
  if (value == null || Number.isNaN(value)) return null;
  if (system === 'rir') return { rir: clampRir(value), approximate: false };
  return { rir: rpeToRir(value), approximate: true };
}

export function formatEffort(
  value: number | null | undefined,
  system: EffortSystem,
): string {
  if (value == null) return '—';
  return system === 'rir' ? `RIR ${value}` : `RPE ${value}`;
}
