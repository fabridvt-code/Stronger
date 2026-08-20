/**
 * Zod contract for AI extraction output (spec §7, §8). The AI does ONLY semantic
 * extraction of fields from messy text. Library matching + all deterministic logic
 * stay in app code. Every field is nullable — the model must not invent values.
 */

import { z } from 'zod';

export const AiExercise = z.object({
  name: z.string(),
  sets: z.number().int().positive().nullable(),
  repMin: z.number().int().positive().nullable(),
  repMax: z.number().int().positive().nullable(),
  targetRir: z.number().min(0).max(6).nullable(),
  targetRpe: z.number().min(4).max(10).nullable(),
  restSec: z.number().int().positive().nullable(),
  tempo: z.string().nullable(),
  note: z.string().nullable(),
  groupHint: z.enum(['straight', 'superset', 'circuit']).default('straight'),
});

export const AiDay = z.object({
  name: z.string(),
  exercises: z.array(AiExercise),
});

export const AiExtraction = z.object({
  programName: z.string().nullable(),
  days: z.array(AiDay),
});

export type AiExtractionT = z.infer<typeof AiExtraction>;
