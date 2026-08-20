/**
 * Convert AI extraction into a ParsedProgram by running the DETERMINISTIC library
 * matcher client-side (spec §8: keep matching/logic in app code, not the LLM).
 * The review UI is then identical for AI and non-AI imports.
 */

import type { Exercise } from '../types';
import type { AiExtractionT } from './schema';
import { matchExercise } from './match';
import type { ParsedExercise, ParsedProgram } from './types';

export function fromAiExtraction(
  extraction: AiExtractionT,
  library: Exercise[],
): ParsedProgram {
  const days = extraction.days.map((day) => ({
    name: day.name || 'Day',
    exercises: day.exercises.map((ex): ParsedExercise => {
      const match = matchExercise(ex.name, library);
      const hasSets = ex.sets != null && ex.repMin != null;
      let confidence = match.confidence * (hasSets ? 1 : 0.85);
      if (!match.exerciseId) confidence = Math.min(confidence, 0.45);
      const status: ParsedExercise['status'] = !match.exerciseId
        ? 'needs_review'
        : !hasSets
          ? 'needs_review'
          : confidence >= 0.8
            ? 'ok'
            : 'needs_review';
      return {
        raw: ex.name,
        name: match.name ?? ex.name,
        matchedExerciseId: match.exerciseId,
        matchedName: match.name,
        sets: ex.sets,
        repMin: ex.repMin,
        repMax: ex.repMax ?? ex.repMin,
        targetRir: ex.targetRir,
        targetRpe: ex.targetRpe,
        restSec: ex.restSec,
        tempo: ex.tempo,
        note: ex.note,
        confidence: Math.round(confidence * 100) / 100,
        status,
        groupHint: ex.groupHint,
      };
    }),
  }));

  return {
    name: extraction.programName || 'Imported Program',
    days,
    source: 'ai',
    unparsed: [],
  };
}
