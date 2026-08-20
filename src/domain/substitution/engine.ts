/**
 * Exercise substitution engine (spec §11–§12).
 *
 * Transparent, deterministic similarity — NOT random AI output. Produces a score
 * in [0,1] with a per-axis breakdown so the user can judge *why* something is a
 * suggested alternative. Hard filters (equipment/contraindications) run before
 * scoring so impossible options never appear.
 */

import { ADJACENT_PATTERNS } from '../values/taxonomy';
import type { Equipment, Muscle } from '../values/taxonomy';
import type { Exercise } from '../types';

/** Tunable weights (sum = 1). Kept as named constants, not magic numbers. */
export const SIMILARITY_WEIGHTS = {
  movementPattern: 0.3,
  muscle: 0.3,
  equipment: 0.15,
  stability: 0.15,
  rom: 0.1,
} as const;

export interface SimilarityBreakdown {
  movementPattern: number; // 0..1
  muscle: number;
  equipment: number;
  stability: number;
  rom: number;
}

export interface SubstitutionCandidate {
  exercise: Exercise;
  score: number; // 0..1 overall
  breakdown: SimilarityBreakdown;
  reason: string;
}

export interface SubstitutionFilters {
  /** Only include exercises whose equipment is a subset of what's available. */
  availableEquipment?: Equipment[];
  /** Restrict to a movement pattern / muscle / difficulty, etc. */
  movementPattern?: string;
  muscle?: Muscle;
  difficulty?: string;
  unilateral?: boolean;
  minSimilarity?: number; // 0..1
  /** IDs the user has pinned as preferred alternatives — boosts ranking. */
  preferredIds?: string[];
}

// ---- axis scorers ---------------------------------------------------------

function movementScore(a: Exercise, b: Exercise): number {
  if (a.movementPattern === b.movementPattern) return 1;
  const neighbours = ADJACENT_PATTERNS[a.movementPattern] ?? [];
  return neighbours.includes(b.movementPattern) ? 0.5 : 0;
}

/**
 * Weighted muscle overlap. Primary muscles weigh 1.0, secondary 0.4.
 * Symmetric: builds a weight map for each exercise and computes a weighted
 * Jaccard-style overlap (intersection / union of weights).
 */
function muscleScore(a: Exercise, b: Exercise): number {
  const weigh = (ex: Exercise): Map<Muscle, number> => {
    const m = new Map<Muscle, number>();
    for (const mu of ex.primaryMuscles) m.set(mu, Math.max(m.get(mu) ?? 0, 1));
    for (const mu of ex.secondaryMuscles) m.set(mu, Math.max(m.get(mu) ?? 0, 0.4));
    return m;
  };
  const wa = weigh(a);
  const wb = weigh(b);
  const all = new Set<Muscle>([...wa.keys(), ...wb.keys()]);
  let inter = 0;
  let union = 0;
  for (const mu of all) {
    const va = wa.get(mu) ?? 0;
    const vb = wb.get(mu) ?? 0;
    inter += Math.min(va, vb);
    union += Math.max(va, vb);
  }
  return union === 0 ? 0 : inter / union;
}

function equipmentScore(a: Exercise, b: Exercise): number {
  if (a.equipment.length === 0 || b.equipment.length === 0) return 0.5;
  const setA = new Set(a.equipment);
  const shared = b.equipment.filter((e) => setA.has(e)).length;
  const union = new Set([...a.equipment, ...b.equipment]).size;
  return union === 0 ? 0 : shared / union;
}

function stabilityScore(a: Exercise, b: Exercise): number {
  // 4 is the max possible difference on a 1..5 scale.
  return 1 - Math.abs(a.stability - b.stability) / 4;
}

function romScore(a: Exercise, b: Exercise): number {
  const order = { short: 0, moderate: 1, long: 2 } as const;
  return 1 - Math.abs(order[a.romProfile] - order[b.romProfile]) / 2;
}

function buildReason(b: SimilarityBreakdown, target: Exercise): string {
  const parts: string[] = [];
  if (b.movementPattern === 1) parts.push('same movement pattern');
  else if (b.movementPattern > 0) parts.push('closely related movement pattern');
  if (b.muscle >= 0.6) parts.push('trains the same primary muscles');
  else if (b.muscle >= 0.3) parts.push('overlapping muscle emphasis');
  if (b.stability >= 0.75) parts.push('similar stability demand');
  if (parts.length === 0) return `Partial match for ${target.name}.`;
  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

// ---- public API -----------------------------------------------------------

export function scoreSimilarity(a: Exercise, b: Exercise): SubstitutionCandidate {
  const breakdown: SimilarityBreakdown = {
    movementPattern: movementScore(a, b),
    muscle: muscleScore(a, b),
    equipment: equipmentScore(a, b),
    stability: stabilityScore(a, b),
    rom: romScore(a, b),
  };
  const score =
    breakdown.movementPattern * SIMILARITY_WEIGHTS.movementPattern +
    breakdown.muscle * SIMILARITY_WEIGHTS.muscle +
    breakdown.equipment * SIMILARITY_WEIGHTS.equipment +
    breakdown.stability * SIMILARITY_WEIGHTS.stability +
    breakdown.rom * SIMILARITY_WEIGHTS.rom;
  return { exercise: b, score, breakdown, reason: buildReason(breakdown, a) };
}

function passesFilters(candidate: Exercise, filters: SubstitutionFilters): boolean {
  if (filters.availableEquipment) {
    const available = new Set(filters.availableEquipment);
    // Every piece of equipment the exercise needs must be available.
    if (!candidate.equipment.every((e) => available.has(e))) return false;
  }
  if (filters.movementPattern && candidate.movementPattern !== filters.movementPattern) return false;
  if (filters.muscle && !candidate.primaryMuscles.includes(filters.muscle)) return false;
  if (filters.difficulty && candidate.difficulty !== filters.difficulty) return false;
  if (filters.unilateral != null && candidate.unilateral !== filters.unilateral) return false;
  return true;
}

/**
 * Rank alternatives to `target` from a `library`, applying filters first.
 * The target itself and soft-deleted rows are excluded. Pinned preferences get a
 * small ranking boost so remembered user choices float to the top (spec §7 UX).
 */
export function findAlternatives(
  target: Exercise,
  library: Exercise[],
  filters: SubstitutionFilters = {},
  limit = 8,
): SubstitutionCandidate[] {
  const pinned = new Set(filters.preferredIds ?? []);
  const minSim = filters.minSimilarity ?? 0.35;

  const scored = library
    .filter((e) => e.id !== target.id && !e.deletedAt && passesFilters(e, filters))
    .map((e) => {
      const c = scoreSimilarity(target, e);
      // Pinned boost is capped so it never fabricates a bad match into a good one.
      const boosted = pinned.has(e.id) ? Math.min(1, c.score + 0.15) : c.score;
      return { ...c, score: boosted };
    })
    .filter((c) => c.score >= minSim)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/** Format a 0..1 score as a whole percentage for display. */
export function toPercent(score: number): number {
  return Math.round(score * 100);
}
