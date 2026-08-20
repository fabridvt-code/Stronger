/**
 * Controlled vocabularies for the exercise domain.
 * These are closed enums so the substitution engine can reason over them
 * deterministically (string matching on free text is not reliable).
 */

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'knee_extension',
  'knee_flexion',
  'hip_extension',
  'calves',
  'biceps',
  'triceps',
  'lateral_deltoid',
  'rear_deltoid',
  'core',
  'conditioning',
  'mobility',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/**
 * Patterns that are biomechanically "adjacent" — a partial-credit graph used by
 * the substitution engine. Symmetric edges; each key lists its neighbours.
 */
export const ADJACENT_PATTERNS: Partial<Record<MovementPattern, MovementPattern[]>> = {
  horizontal_push: ['vertical_push'],
  vertical_push: ['horizontal_push', 'lateral_deltoid'],
  horizontal_pull: ['vertical_pull', 'rear_deltoid'],
  vertical_pull: ['horizontal_pull', 'biceps'],
  squat: ['lunge', 'knee_extension'],
  hinge: ['hip_extension'],
  lunge: ['squat', 'knee_extension'],
  knee_extension: ['squat', 'lunge'],
  knee_flexion: ['hip_extension'],
  hip_extension: ['hinge', 'knee_flexion'],
  lateral_deltoid: ['vertical_push', 'rear_deltoid'],
  rear_deltoid: ['horizontal_pull', 'lateral_deltoid'],
  biceps: ['vertical_pull'],
  triceps: ['horizontal_push'],
};

export const MUSCLES = [
  'chest',
  'anterior_deltoid',
  'lateral_deltoid',
  'rear_deltoid',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'traps',
  'rhomboids',
  'erectors',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'abs',
  'obliques',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith_machine',
  'bodyweight',
  'kettlebell',
  'band',
  'ez_bar',
  'trap_bar',
  'plate',
  'bench',
  'pullup_bar',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const DIFFICULTY = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTY)[number];

export const EXERCISE_CATEGORIES = [
  'compound',
  'isolation',
  'accessory',
  'conditioning',
  'mobility',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/**
 * Stability rating: how much the movement is stabilised by the environment.
 * 1 = maximally supported (machine, chest-supported), 5 = free / highly unstable.
 * Used as a similarity axis — swapping a stable machine for a free-weight lift
 * changes the demand even when the target muscle is identical.
 */
export type StabilityRating = 1 | 2 | 3 | 4 | 5;

/** Range-of-motion profile — coarse bucket used as a similarity axis. */
export const ROM_PROFILES = ['short', 'moderate', 'long'] as const;
export type RomProfile = (typeof ROM_PROFILES)[number];
