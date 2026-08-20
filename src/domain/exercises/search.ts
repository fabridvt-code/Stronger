/**
 * Exercise library search (spec §29). Matches name, aliases, muscle, equipment,
 * and movement pattern. Deterministic and testable — no external index needed at
 * MVP scale (a few hundred exercises).
 */

import type { Exercise } from '../types';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (à→a) for messy multilingual input
    .trim();
}

/** All searchable text for an exercise, normalised. */
function haystack(ex: Exercise): string {
  return norm(
    [
      ex.name,
      ...ex.aliases,
      ex.movementPattern.replace(/_/g, ' '),
      ...ex.primaryMuscles,
      ...ex.secondaryMuscles,
      ...ex.equipment,
    ].join(' '),
  );
}

/**
 * Multi-term AND search: every whitespace-separated term must match somewhere.
 * "cable chest" → exercises whose text contains both "cable" and "chest".
 * Results are ranked: name-prefix > name-contains > alias/other.
 */
export function searchExercises(query: string, library: Exercise[]): Exercise[] {
  const q = norm(query);
  if (!q) return library.filter((e) => !e.deletedAt);
  const terms = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ ex: Exercise; rank: number }> = [];
  for (const ex of library) {
    if (ex.deletedAt) continue;
    const text = haystack(ex);
    const name = norm(ex.name);
    if (!terms.every((t) => text.includes(t))) continue;

    let rank = 0;
    if (name.startsWith(q)) rank = 3;
    else if (name.includes(q)) rank = 2;
    else if (terms.every((t) => name.includes(t))) rank = 1;
    scored.push({ ex, rank });
  }

  return scored
    .sort((a, b) => b.rank - a.rank || a.ex.name.localeCompare(b.ex.name))
    .map((s) => s.ex);
}
