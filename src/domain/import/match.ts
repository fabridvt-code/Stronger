/**
 * Match a free-text exercise name to a library exercise (spec §7, §28).
 * Deterministic and transparent — returns a confidence the review screen shows.
 */

import type { Exercise } from '../types';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MatchResult {
  exerciseId: string | null;
  name: string | null;
  confidence: number; // 0..1
}

/**
 * Confidence tiers:
 *   1.00 exact name or exact alias match
 *   0.85 name/alias contains the query (or vice-versa) as a whole phrase
 *   0.5–0.8 token overlap (Jaccard) above threshold
 *   null  no confident match → caller flags NEEDS_REVIEW
 */
export function matchExercise(input: string, library: Exercise[]): MatchResult {
  const q = norm(input);
  if (!q) return { exerciseId: null, name: null, confidence: 0 };
  const qTokens = new Set(q.split(' '));

  let best: MatchResult = { exerciseId: null, name: null, confidence: 0 };

  for (const ex of library) {
    if (ex.deletedAt) continue;
    const candidates = [ex.name, ...ex.aliases].map(norm);

    for (const cand of candidates) {
      let score = 0;
      if (cand === q) score = 1;
      else if (cand.includes(q) || q.includes(cand)) score = 0.85;
      else {
        const cTokens = new Set(cand.split(' '));
        let inter = 0;
        for (const t of qTokens) if (cTokens.has(t)) inter++;
        const union = new Set([...qTokens, ...cTokens]).size;
        const jaccard = union === 0 ? 0 : inter / union;
        if (jaccard >= 0.34) score = 0.5 + jaccard * 0.3;
      }
      if (score > best.confidence) {
        best = { exerciseId: ex.id, name: ex.name, confidence: Math.min(1, score) };
      }
    }
  }

  // Below this threshold we don't trust the match.
  if (best.confidence < 0.5) return { exerciseId: null, name: null, confidence: best.confidence };
  return best;
}
