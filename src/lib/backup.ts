/**
 * Data export / import (spec §29, §30). Users own their data — no lock-in.
 * Exports every user table (not the builtin library) to a portable JSON bundle.
 */

import { db } from './db';

export const BACKUP_VERSION = 1;

const USER_TABLES = [
  'programs', 'phases', 'weeks', 'workouts', 'workoutExercises', 'setTemplates',
  'sessions', 'completedSets', 'progressionRules', 'personalRecords', 'bodyMetrics',
  'preferences',
] as const;

export interface Backup {
  format: 'stronger-backup';
  version: number;
  exportedAt: number;
  tables: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<Backup> {
  const d = db();
  const tables: Record<string, unknown[]> = {};
  for (const name of USER_TABLES) {
    tables[name] = await d[name].toArray();
  }
  // Include user-created (non-builtin) exercises too.
  tables.exercises = (await d.exercises.toArray()).filter((e) => !e.builtin);
  return { format: 'stronger-backup', version: BACKUP_VERSION, exportedAt: Date.now(), tables };
}

export async function exportBackupJson(): Promise<string> {
  return JSON.stringify(await exportBackup(), null, 2);
}

/** Restore a backup. Merges by primary key (put), preserving builtin library. */
export async function importBackup(json: string): Promise<{ imported: number }> {
  const parsed = JSON.parse(json) as Backup;
  if (parsed.format !== 'stronger-backup') {
    throw new Error('Not a Stronger backup file.');
  }
  const d = db();
  let imported = 0;
  for (const [name, rows] of Object.entries(parsed.tables)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    // @ts-expect-error dynamic table access by name
    const table = d[name];
    if (!table) continue;
    await table.bulkPut(rows);
    imported += rows.length;
  }
  return { imported };
}

/** Flatten completed sets to CSV (spec §29). */
export async function exportSetsCsv(): Promise<string> {
  const sets = await db().completedSets.toArray();
  const header = ['completedAt', 'exerciseId', 'setIndex', 'setType', 'load', 'unit', 'reps', 'rir', 'rpe'];
  const lines = [header.join(',')];
  for (const s of sets.filter((x) => !x.deletedAt).sort((a, b) => a.completedAt - b.completedAt)) {
    lines.push(
      [
        new Date(s.completedAt).toISOString(),
        s.exerciseId,
        s.setIndex,
        s.setType,
        s.actualLoad ?? '',
        s.unit,
        s.actualReps ?? '',
        s.actualRir ?? '',
        s.actualRpe ?? '',
      ].join(','),
    );
  }
  return lines.join('\n');
}
