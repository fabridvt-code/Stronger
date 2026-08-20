/**
 * Load / weight value helpers. Units are a user preference; internally we store a
 * numeric `load` plus a `unit`. Plate rounding is deterministic and conservative.
 */

export type WeightUnit = 'kg' | 'lb';

/**
 * Smallest increment the user can actually load on the bar/machine.
 * Defaults: 2.5 kg (a pair of 1.25 kg plates) or 5 lb.
 */
export interface RoundingConfig {
  unit: WeightUnit;
  increment: number;
}

export const DEFAULT_ROUNDING: Record<WeightUnit, RoundingConfig> = {
  kg: { unit: 'kg', increment: 2.5 },
  lb: { unit: 'lb', increment: 5 },
};

/** Round to the nearest achievable increment. */
export function roundToIncrement(load: number, increment: number): number {
  if (increment <= 0) return load;
  return Math.round(load / increment) * increment;
}

/**
 * Round DOWN to the nearest achievable increment.
 * Used when INCREASING load, so the system never over-prescribes (spec §12:
 * "progression must be conservative").
 */
export function floorToIncrement(load: number, increment: number): number {
  if (increment <= 0) return load;
  return Math.floor(load / increment + 1e-9) * increment;
}

const LB_PER_KG = 2.2046226218;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

export function formatLoad(load: number | null | undefined, unit: WeightUnit): string {
  if (load == null) return '—';
  // Trim trailing .0 but keep .5 etc.
  const rounded = Math.round(load * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} ${unit}`;
}
