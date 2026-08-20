/**
 * Deterministic workout-text parser (spec §27). Handles messy real-world input
 * in English and Italian, e.g.:
 *   "Monday — Push"
 *   "Bench Press 4x6-8 RIR 2"
 *   "Panca 4x6/8 RIR 2"
 *   "alzate laterali 3x12-15"
 *   "curl ai cavi 3x8-12"
 *
 * This is the AI-free fallback and is fully unit-tested. The AI route (Phase 2)
 * produces the SAME ParsedProgram shape, so the review UI is identical.
 *
 * Never invents data: unknown fields are null; unmatched exercises are NEEDS_REVIEW.
 */

import type { Exercise } from '../types';
import { matchExercise } from './match';
import type { ParsedDay, ParsedExercise, ParsedProgram } from './types';

const DAY_KEYWORDS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
  'day', 'giorno', 'workout', 'session', 'week',
];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** A header line names a training day rather than an exercise. */
function isDayHeader(line: string): boolean {
  const l = stripAccents(line.toLowerCase());
  // "Monday — Push", "Day 1: Push", "Giorno 1 - Spinta"
  if (/^[a-z\s]+[—:\-]\s*\S+/.test(l) && DAY_KEYWORDS.some((k) => l.startsWith(k))) return true;
  if (DAY_KEYWORDS.some((k) => l === k || l.startsWith(k + ' '))) return true;
  return false;
}

function cleanDayName(line: string): string {
  return line.replace(/^[\s#*>-]+/, '').trim();
}

/** Sets × reps, e.g. "4x6-8", "4×6/8", "3x10", "3 x 12 - 15". */
const SETS_REPS = /(\d+)\s*[x×]\s*(\d+)\s*(?:[-/–]\s*(\d+))?/i;
const RIR_RE = /rir\s*(\d+)/i;
const RPE_RE = /rpe\s*(\d+(?:\.\d)?)/i;
const REST_RE = /(?:rest|riposo|recupero)\s*[:=]?\s*(\d+)\s*(?:s|sec|")?|(\d+)\s*(?:sec|s)\b/i;
const TEMPO_RE = /\b(\d)\s*[-/]\s*(\d)\s*[-/]\s*(\d)(?:\s*[-/]\s*(\d))?\b\s*tempo|tempo\s*[:=]?\s*(\d[-/]\d[-/]\d(?:[-/]\d)?)/i;
const SIMPLE_TEMPO_RE = /\b(\d[-/]\d[-/]\d(?:[-/]\d)?)\b/;

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Extract the exercise name by removing every token we recognised as a parameter. */
function extractName(line: string): string {
  let name = line;
  name = name.replace(SETS_REPS, ' ');
  name = name.replace(RIR_RE, ' ');
  name = name.replace(RPE_RE, ' ');
  name = name.replace(/(?:rest|riposo|recupero)\s*[:=]?\s*\d+\s*(?:s|sec|")?/i, ' ');
  name = name.replace(/\b\d+\s*(?:sec|s)\b/i, ' ');
  name = name.replace(SIMPLE_TEMPO_RE, ' ');
  name = name.replace(/^[\s#*>\-•.\d)]+/, ' ');
  name = name.replace(/[×x*]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

function parseExerciseLine(raw: string, library: Exercise[]): ParsedExercise | null {
  const line = raw.trim();
  if (!line) return null;

  const setsReps = SETS_REPS.exec(line);
  const name = extractName(line);
  if (!name && !setsReps) return null; // nothing usable

  const sets = setsReps ? num(setsReps[1]) : null;
  const repMin = setsReps ? num(setsReps[2]) : null;
  const repMax = setsReps ? (num(setsReps[3]) ?? num(setsReps[2])) : null;

  const rir = RIR_RE.exec(line);
  const rpe = RPE_RE.exec(line);
  const rest = REST_RE.exec(line);
  const tempoSimple = SIMPLE_TEMPO_RE.exec(line);

  const match = matchExercise(name, library);

  // Confidence: blend match confidence with structural completeness.
  const hasSets = sets != null && repMin != null;
  let confidence = match.confidence * (hasSets ? 1 : 0.85);
  if (!match.exerciseId) confidence = Math.min(confidence, 0.45);

  const status: ParsedExercise['status'] =
    !match.exerciseId ? 'needs_review' : !hasSets ? 'needs_review' : confidence >= 0.8 ? 'ok' : 'needs_review';

  const groupHint: ParsedExercise['groupHint'] = /superset|super\s*set|ss\b/i.test(line)
    ? 'superset'
    : /circuit|circuito/i.test(line)
      ? 'circuit'
      : 'straight';

  return {
    raw,
    name: match.name ?? name,
    matchedExerciseId: match.exerciseId,
    matchedName: match.name,
    sets,
    repMin,
    repMax,
    targetRir: rir ? num(rir[1]) : null,
    targetRpe: rpe ? num(rpe[1]) : null,
    restSec: rest ? num(rest[1] ?? rest[2]) : null,
    tempo: tempoSimple ? tempoSimple[1]!.replace(/\//g, '-') : null,
    note: null,
    confidence: Math.round(confidence * 100) / 100,
    status,
    groupHint,
  };
}

export function parseWorkoutText(
  text: string,
  library: Exercise[],
  programName = 'Imported Program',
): ParsedProgram {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const days: ParsedDay[] = [];
  const unparsed: string[] = [];
  let current: ParsedDay | null = null;

  for (const line of lines) {
    if (isDayHeader(line)) {
      current = { name: cleanDayName(line), exercises: [] };
      days.push(current);
      continue;
    }
    const parsed = parseExerciseLine(line, library);
    if (!parsed) {
      unparsed.push(line);
      continue;
    }
    if (!current) {
      current = { name: 'Day 1', exercises: [] };
      days.push(current);
    }
    current.exercises.push(parsed);
  }

  return { name: programName, days, source: 'deterministic', unparsed };
}
