/**
 * Deterministic performance metrics. Pure functions over performed data.
 * These are RECOMMENDED/derived values — always recomputed, never stored as truth.
 */

import type { CompletedSet } from '../types';

/**
 * Estimated 1RM (Epley): e1RM = load * (1 + reps/30).
 * Used for trends and PRs only — never to aggressively auto-prescribe (spec §9).
 * Returns null when inputs are missing or reps<=0.
 */
export function estimate1RM(load: number | null, reps: number | null): number | null {
  if (load == null || reps == null || reps <= 0 || load <= 0) return null;
  if (reps === 1) return load;
  return load * (1 + reps / 30);
}

/** Round e1RM for display without implying false precision. */
export function roundE1RM(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Volume load for a single set = load * reps (0 if either missing). */
export function setVolumeLoad(set: Pick<CompletedSet, 'actualLoad' | 'actualReps'>): number {
  if (set.actualLoad == null || set.actualReps == null) return 0;
  return set.actualLoad * set.actualReps;
}

/** Total volume load across sets. */
export function totalVolumeLoad(sets: CompletedSet[]): number {
  return sets.reduce((sum, s) => sum + setVolumeLoad(s), 0);
}

/** Number of working sets (excludes warmups) — the standard "hard sets" count. */
export function workingSetCount(sets: CompletedSet[]): number {
  return sets.filter((s) => s.setType !== 'warmup').length;
}

/** Best e1RM across a collection of sets. */
export function bestE1RM(sets: CompletedSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const e = estimate1RM(s.actualLoad, s.actualReps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

export interface HistoryPoint {
  at: number;
  e1rm: number | null;
  topLoad: number | null;
  volume: number;
}

/**
 * Collapse a set list (already filtered to one exercise) into per-session points,
 * ordered oldest→newest. `sessionOf` maps a set to its session id.
 */
export function historyBySession(
  sets: CompletedSet[],
  sessionStart: Map<string, number>,
): HistoryPoint[] {
  const bySession = new Map<string, CompletedSet[]>();
  for (const s of sets) {
    const arr = bySession.get(s.sessionId) ?? [];
    arr.push(s);
    bySession.set(s.sessionId, arr);
  }
  const points: HistoryPoint[] = [];
  for (const [sessionId, list] of bySession) {
    const at = sessionStart.get(sessionId) ?? Math.min(...list.map((l) => l.completedAt));
    const working = list.filter((l) => l.setType !== 'warmup');
    const topLoad = working.reduce<number | null>(
      (max, l) => (l.actualLoad != null && (max == null || l.actualLoad > max) ? l.actualLoad : max),
      null,
    );
    points.push({
      at,
      e1rm: bestE1RM(working),
      topLoad,
      volume: totalVolumeLoad(working),
    });
  }
  return points.sort((a, b) => a.at - b.at);
}
