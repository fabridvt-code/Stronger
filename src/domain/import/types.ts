/**
 * Import types (spec §7, §27, §28). The parser produces these; the review screen
 * lets the user confirm/correct before anything becomes a real program.
 *
 * Nothing is silently invented — missing fields are `null` and low-confidence rows
 * are flagged NEEDS_REVIEW.
 */

export type FieldStatus = 'ok' | 'missing' | 'needs_review';

export interface ParsedExercise {
  /** Raw text as written by the user (kept for the review screen). */
  raw: string;
  /** Best-guess exercise name (normalised from the raw text). */
  name: string;
  /** Library match, if one was found. */
  matchedExerciseId: string | null;
  matchedName: string | null;
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSec: number | null;
  tempo: string | null;
  note: string | null;
  /** 0..1 overall confidence for this row. */
  confidence: number;
  status: FieldStatus;
  /** Grouping hints detected from the text (superset markers etc.). */
  groupHint: 'straight' | 'superset' | 'circuit';
}

export interface ParsedDay {
  name: string;
  exercises: ParsedExercise[];
}

export interface ParsedProgram {
  name: string;
  days: ParsedDay[];
  /** Where the extraction came from — surfaced to the user for transparency. */
  source: 'deterministic' | 'ai';
  /** Lines the parser could not interpret at all. */
  unparsed: string[];
}
