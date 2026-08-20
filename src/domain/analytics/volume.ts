/**
 * Volume & consistency analytics (spec §16, §22). Pure, deterministic functions
 * over performed data + the exercise library. Derived values — recomputed, not stored.
 */

import type { CompletedSet, Exercise } from '../types';
import type { Muscle } from '../values/taxonomy';
import { setVolumeLoad } from './metrics';

/** A working set contributes 1.0 to each primary muscle, 0.5 to each secondary. */
const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.5;

export interface MuscleVolume {
  muscle: Muscle;
  sets: number; // weighted "hard sets"
  volumeLoad: number; // load*reps summed
}

/**
 * Weighted sets and volume-load per muscle over a set list (already filtered to a
 * time window by the caller). Warm-ups are excluded.
 */
export function setsPerMuscle(
  sets: CompletedSet[],
  exercisesById: Map<string, Exercise>,
): MuscleVolume[] {
  const acc = new Map<Muscle, { sets: number; volumeLoad: number }>();
  const bump = (m: Muscle, weight: number, vol: number) => {
    const cur = acc.get(m) ?? { sets: 0, volumeLoad: 0 };
    cur.sets += weight;
    cur.volumeLoad += vol * weight;
    acc.set(m, cur);
  };

  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const ex = exercisesById.get(s.exerciseId);
    if (!ex) continue;
    const vol = setVolumeLoad(s);
    for (const m of ex.primaryMuscles) bump(m, PRIMARY_WEIGHT, vol);
    for (const m of ex.secondaryMuscles) bump(m, SECONDARY_WEIGHT, vol);
  }

  return [...acc.entries()]
    .map(([muscle, v]) => ({ muscle, sets: Math.round(v.sets * 10) / 10, volumeLoad: Math.round(v.volumeLoad) }))
    .sort((a, b) => b.sets - a.sets);
}

/** ISO-week key (year + week number) for grouping. */
export function weekKey(epochMs: number): string {
  const d = new Date(epochMs);
  const day = (d.getUTCDay() + 6) % 7; // Monday=0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const jan1 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
  const week = Math.floor((monday.getTime() - jan1.getTime()) / (7 * 864e5)) + 1;
  return `${monday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface WeekPoint {
  week: string;
  sessions: number;
  sets: number;
  volumeLoad: number;
}

/**
 * Group completed sessions into weekly buckets for the consistency/volume charts.
 * `sessionStart` maps sessionId → start epoch so we bucket by session, not by set.
 */
export function weeklyConsistency(
  sets: CompletedSet[],
  sessionStart: Map<string, number>,
  weeks = 8,
): WeekPoint[] {
  const byWeek = new Map<string, { sessions: Set<string>; sets: number; volume: number }>();
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const at = sessionStart.get(s.sessionId) ?? s.completedAt;
    const key = weekKey(at);
    const cur = byWeek.get(key) ?? { sessions: new Set<string>(), sets: 0, volume: 0 };
    cur.sessions.add(s.sessionId);
    cur.sets += 1;
    cur.volume += setVolumeLoad(s);
    byWeek.set(key, cur);
  }
  return [...byWeek.entries()]
    .map(([week, v]) => ({
      week,
      sessions: v.sessions.size,
      sets: v.sets,
      volumeLoad: Math.round(v.volume),
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-weeks);
}
