/**
 * Seeded exercise library (spec §10). Real, structured data — not placeholders.
 * Covers every movement pattern so the substitution engine always has candidates.
 *
 * These are `builtin: true`. Users can add their own; those get `builtin: false`.
 */

import type { Exercise } from '../types';
import type {
  Difficulty,
  Equipment,
  ExerciseCategory,
  MovementPattern,
  Muscle,
  RomProfile,
  StabilityRating,
} from '../values/taxonomy';

interface SeedInput {
  id: string;
  name: string;
  aliases?: string[];
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment: Equipment[];
  difficulty?: Difficulty;
  unilateral?: boolean;
  stability: StabilityRating;
  romProfile?: RomProfile;
  repRange?: [number, number];
  restSec?: number;
  instructions?: string;
  commonErrors?: string[];
}

const EPOCH = 0; // builtin rows share a fixed timestamp; they are never synced as user data

function make(s: SeedInput): Exercise {
  const [min, max] = s.repRange ?? [8, 12];
  return {
    id: s.id,
    name: s.name,
    aliases: s.aliases ?? [],
    category: s.category,
    movementPattern: s.movementPattern,
    primaryMuscles: s.primaryMuscles,
    secondaryMuscles: s.secondaryMuscles ?? [],
    equipment: s.equipment,
    difficulty: s.difficulty ?? 'intermediate',
    unilateral: s.unilateral ?? false,
    stability: s.stability,
    romProfile: s.romProfile ?? 'moderate',
    defaultRepRange: { min, max },
    defaultRestSec: s.restSec ?? 120,
    instructions: s.instructions,
    commonErrors: s.commonErrors,
    builtin: true,
    // SyncMeta
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deletedAt: null,
    version: 1,
  };
}

export const EXERCISE_SEED: Exercise[] = [
  // ---- Horizontal Push ----
  make({ id: 'ex_bench_press', name: 'Barbell Bench Press', aliases: ['bench', 'panca', 'panca piana', 'flat bench'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps'], equipment: ['barbell', 'bench'], stability: 4, repRange: [5, 8], restSec: 150 }),
  make({ id: 'ex_db_bench_press', name: 'Dumbbell Bench Press', aliases: ['db bench', 'dumbbell press'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps'], equipment: ['dumbbell', 'bench'], stability: 5, repRange: [8, 12] }),
  make({ id: 'ex_incline_db_press', name: 'Incline Dumbbell Press', aliases: ['incline db', 'incline dumbbell'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest', 'anterior_deltoid'], secondaryMuscles: ['triceps'], equipment: ['dumbbell', 'bench'], stability: 5, repRange: [8, 12] }),
  make({ id: 'ex_incline_bb_press', name: 'Incline Barbell Press', aliases: ['incline bench'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest', 'anterior_deltoid'], secondaryMuscles: ['triceps'], equipment: ['barbell', 'bench'], stability: 4, repRange: [6, 10] }),
  make({ id: 'ex_smith_bench', name: 'Smith Machine Bench Press', aliases: ['smith bench'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps'], equipment: ['smith_machine', 'bench'], stability: 2, repRange: [6, 10] }),
  make({ id: 'ex_chest_press_machine', name: 'Chest Press Machine', aliases: ['machine press', 'chest press'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps'], equipment: ['machine'], stability: 1, repRange: [8, 12] }),
  make({ id: 'ex_cable_chest_press', name: 'Cable Chest Press', aliases: ['cable press'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps'], equipment: ['cable'], stability: 3, repRange: [8, 12] }),
  make({ id: 'ex_pushup', name: 'Push-Up', aliases: ['pushup', 'press up'], category: 'compound', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], secondaryMuscles: ['anterior_deltoid', 'triceps', 'abs'], equipment: ['bodyweight'], difficulty: 'beginner', stability: 4, repRange: [8, 20] }),
  make({ id: 'ex_cable_fly', name: 'Cable Fly', aliases: ['cable flye', 'chest fly'], category: 'isolation', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], equipment: ['cable'], stability: 3, romProfile: 'long', repRange: [10, 15] }),
  make({ id: 'ex_pec_deck', name: 'Pec Deck', aliases: ['machine fly', 'butterfly'], category: 'isolation', movementPattern: 'horizontal_push', primaryMuscles: ['chest'], equipment: ['machine'], stability: 1, repRange: [10, 15] }),

  // ---- Vertical Push ----
  make({ id: 'ex_ohp', name: 'Overhead Press', aliases: ['ohp', 'military press', 'shoulder press', 'lento avanti'], category: 'compound', movementPattern: 'vertical_push', primaryMuscles: ['anterior_deltoid'], secondaryMuscles: ['lateral_deltoid', 'triceps'], equipment: ['barbell'], stability: 4, repRange: [5, 8], restSec: 150 }),
  make({ id: 'ex_db_shoulder_press', name: 'Dumbbell Shoulder Press', aliases: ['db shoulder press', 'seated db press'], category: 'compound', movementPattern: 'vertical_push', primaryMuscles: ['anterior_deltoid'], secondaryMuscles: ['lateral_deltoid', 'triceps'], equipment: ['dumbbell'], stability: 5, repRange: [8, 12] }),
  make({ id: 'ex_machine_shoulder_press', name: 'Machine Shoulder Press', category: 'compound', movementPattern: 'vertical_push', primaryMuscles: ['anterior_deltoid'], secondaryMuscles: ['lateral_deltoid', 'triceps'], equipment: ['machine'], stability: 1, repRange: [8, 12] }),

  // ---- Lateral Deltoid ----
  make({ id: 'ex_lateral_raise', name: 'Dumbbell Lateral Raise', aliases: ['lateral raises', 'side raise', 'alzate laterali'], category: 'isolation', movementPattern: 'lateral_deltoid', primaryMuscles: ['lateral_deltoid'], equipment: ['dumbbell'], stability: 4, repRange: [12, 20], restSec: 75 }),
  make({ id: 'ex_cable_lateral_raise', name: 'Cable Lateral Raise', aliases: ['cable side raise'], category: 'isolation', movementPattern: 'lateral_deltoid', primaryMuscles: ['lateral_deltoid'], equipment: ['cable'], stability: 3, repRange: [12, 20], restSec: 75 }),
  make({ id: 'ex_machine_lateral_raise', name: 'Machine Lateral Raise', category: 'isolation', movementPattern: 'lateral_deltoid', primaryMuscles: ['lateral_deltoid'], equipment: ['machine'], stability: 1, repRange: [12, 20], restSec: 75 }),

  // ---- Rear Deltoid ----
  make({ id: 'ex_reverse_pec_deck', name: 'Reverse Pec Deck', aliases: ['rear delt machine', 'reverse fly machine'], category: 'isolation', movementPattern: 'rear_deltoid', primaryMuscles: ['rear_deltoid'], equipment: ['machine'], stability: 1, repRange: [12, 20], restSec: 75 }),
  make({ id: 'ex_cable_rear_delt_fly', name: 'Cable Rear Delt Fly', category: 'isolation', movementPattern: 'rear_deltoid', primaryMuscles: ['rear_deltoid'], equipment: ['cable'], stability: 3, repRange: [12, 20], restSec: 75 }),
  make({ id: 'ex_db_rear_delt_fly', name: 'Dumbbell Rear Delt Fly', aliases: ['bent over reverse fly'], category: 'isolation', movementPattern: 'rear_deltoid', primaryMuscles: ['rear_deltoid'], equipment: ['dumbbell'], stability: 4, repRange: [12, 20], restSec: 75 }),

  // ---- Horizontal Pull ----
  make({ id: 'ex_barbell_row', name: 'Barbell Row', aliases: ['bent over row', 'bb row', 'rematore'], category: 'compound', movementPattern: 'horizontal_pull', primaryMuscles: ['lats', 'rhomboids'], secondaryMuscles: ['biceps', 'rear_deltoid', 'traps'], equipment: ['barbell'], stability: 4, repRange: [6, 10], restSec: 150 }),
  make({ id: 'ex_db_row', name: 'Dumbbell Row', aliases: ['db row', 'one arm row', 'single arm row'], category: 'compound', movementPattern: 'horizontal_pull', primaryMuscles: ['lats', 'rhomboids'], secondaryMuscles: ['biceps', 'rear_deltoid'], equipment: ['dumbbell', 'bench'], unilateral: true, stability: 4, repRange: [8, 12] }),
  make({ id: 'ex_seated_cable_row', name: 'Seated Cable Row', aliases: ['cable row', 'row machine', 'pulley'], category: 'compound', movementPattern: 'horizontal_pull', primaryMuscles: ['lats', 'rhomboids'], secondaryMuscles: ['biceps', 'rear_deltoid'], equipment: ['cable'], stability: 2, repRange: [8, 12] }),
  make({ id: 'ex_chest_supported_row', name: 'Chest-Supported Row', aliases: ['t-bar row', 'machine row'], category: 'compound', movementPattern: 'horizontal_pull', primaryMuscles: ['lats', 'rhomboids'], secondaryMuscles: ['biceps', 'rear_deltoid'], equipment: ['machine'], stability: 1, repRange: [8, 12] }),

  // ---- Vertical Pull ----
  make({ id: 'ex_pullup', name: 'Pull-Up', aliases: ['pull up', 'chin up', 'trazioni'], category: 'compound', movementPattern: 'vertical_pull', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'rhomboids'], equipment: ['pullup_bar', 'bodyweight'], difficulty: 'advanced', stability: 4, repRange: [5, 12], restSec: 150 }),
  make({ id: 'ex_lat_pulldown', name: 'Lat Pulldown', aliases: ['lat machine', 'pulldown', 'lat pull down'], category: 'compound', movementPattern: 'vertical_pull', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'rhomboids'], equipment: ['cable'], stability: 2, repRange: [8, 12] }),
  make({ id: 'ex_assisted_pullup', name: 'Assisted Pull-Up', aliases: ['machine assisted pullup'], category: 'compound', movementPattern: 'vertical_pull', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'rhomboids'], equipment: ['machine'], difficulty: 'beginner', stability: 2, repRange: [8, 12] }),

  // ---- Squat ----
  make({ id: 'ex_back_squat', name: 'Barbell Back Squat', aliases: ['squat', 'back squat', 'high bar squat'], category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['adductors', 'erectors'], equipment: ['barbell'], difficulty: 'advanced', stability: 4, repRange: [5, 8], restSec: 180 }),
  make({ id: 'ex_front_squat', name: 'Front Squat', category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'erectors', 'abs'], equipment: ['barbell'], difficulty: 'advanced', stability: 4, repRange: [5, 8], restSec: 180 }),
  make({ id: 'ex_hack_squat', name: 'Hack Squat', aliases: ['machine hack squat'], category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: ['machine'], stability: 2, repRange: [8, 12], restSec: 150 }),
  make({ id: 'ex_leg_press', name: 'Leg Press', aliases: ['pressa', '45 leg press'], category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['adductors'], equipment: ['machine'], stability: 1, repRange: [8, 15], restSec: 150 }),
  make({ id: 'ex_goblet_squat', name: 'Goblet Squat', category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads', 'glutes'], equipment: ['dumbbell', 'kettlebell'], difficulty: 'beginner', stability: 3, repRange: [8, 15] }),
  make({ id: 'ex_smith_squat', name: 'Smith Machine Squat', category: 'compound', movementPattern: 'squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['adductors'], equipment: ['smith_machine'], stability: 2, repRange: [8, 12], restSec: 150 }),

  // ---- Hinge / Hip Extension ----
  make({ id: 'ex_deadlift', name: 'Conventional Deadlift', aliases: ['deadlift', 'stacco'], category: 'compound', movementPattern: 'hinge', primaryMuscles: ['glutes', 'hamstrings', 'erectors'], secondaryMuscles: ['lats', 'traps', 'quads'], equipment: ['barbell'], difficulty: 'advanced', stability: 4, repRange: [3, 6], restSec: 210 }),
  make({ id: 'ex_rdl', name: 'Romanian Deadlift', aliases: ['rdl', 'stacco rumeno'], category: 'compound', movementPattern: 'hinge', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['erectors'], equipment: ['barbell'], stability: 4, romProfile: 'long', repRange: [6, 10], restSec: 150 }),
  make({ id: 'ex_db_rdl', name: 'Dumbbell Romanian Deadlift', aliases: ['db rdl'], category: 'compound', movementPattern: 'hinge', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['erectors'], equipment: ['dumbbell'], stability: 4, romProfile: 'long', repRange: [8, 12] }),
  make({ id: 'ex_hip_thrust', name: 'Barbell Hip Thrust', aliases: ['hip thrust'], category: 'compound', movementPattern: 'hip_extension', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], equipment: ['barbell', 'bench'], stability: 3, repRange: [8, 12], restSec: 120 }),
  make({ id: 'ex_back_extension', name: 'Back Extension', aliases: ['hyperextension', '45 back extension'], category: 'isolation', movementPattern: 'hip_extension', primaryMuscles: ['erectors', 'glutes'], secondaryMuscles: ['hamstrings'], equipment: ['bodyweight'], difficulty: 'beginner', stability: 3, repRange: [10, 15] }),

  // ---- Knee Flexion (Hamstrings) ----
  make({ id: 'ex_lying_leg_curl', name: 'Lying Leg Curl', aliases: ['leg curl', 'hamstring curl'], category: 'isolation', movementPattern: 'knee_flexion', primaryMuscles: ['hamstrings'], equipment: ['machine'], stability: 1, repRange: [10, 15], restSec: 90 }),
  make({ id: 'ex_seated_leg_curl', name: 'Seated Leg Curl', category: 'isolation', movementPattern: 'knee_flexion', primaryMuscles: ['hamstrings'], equipment: ['machine'], stability: 1, repRange: [10, 15], restSec: 90 }),
  make({ id: 'ex_nordic_curl', name: 'Nordic Hamstring Curl', category: 'isolation', movementPattern: 'knee_flexion', primaryMuscles: ['hamstrings'], equipment: ['bodyweight'], difficulty: 'advanced', stability: 4, repRange: [4, 8] }),

  // ---- Knee Extension (Quads) ----
  make({ id: 'ex_leg_extension', name: 'Leg Extension', aliases: ['quad extension', 'leg ext'], category: 'isolation', movementPattern: 'knee_extension', primaryMuscles: ['quads'], equipment: ['machine'], stability: 1, repRange: [10, 15], restSec: 90 }),

  // ---- Lunge ----
  make({ id: 'ex_walking_lunge', name: 'Walking Lunge', aliases: ['lunges', 'affondi'], category: 'compound', movementPattern: 'lunge', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'adductors'], equipment: ['dumbbell', 'bodyweight'], unilateral: true, stability: 4, repRange: [8, 12] }),
  make({ id: 'ex_bulgarian_split_squat', name: 'Bulgarian Split Squat', aliases: ['bss', 'rear foot elevated split squat'], category: 'compound', movementPattern: 'lunge', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], equipment: ['dumbbell', 'bench'], unilateral: true, stability: 4, repRange: [8, 12] }),

  // ---- Calves ----
  make({ id: 'ex_standing_calf_raise', name: 'Standing Calf Raise', aliases: ['calf raise'], category: 'isolation', movementPattern: 'calves', primaryMuscles: ['calves'], equipment: ['machine'], stability: 2, repRange: [10, 20], restSec: 75 }),
  make({ id: 'ex_seated_calf_raise', name: 'Seated Calf Raise', category: 'isolation', movementPattern: 'calves', primaryMuscles: ['calves'], equipment: ['machine'], stability: 1, repRange: [12, 20], restSec: 75 }),

  // ---- Biceps ----
  make({ id: 'ex_barbell_curl', name: 'Barbell Curl', aliases: ['bb curl', 'curl bilanciere'], category: 'isolation', movementPattern: 'biceps', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: ['barbell', 'ez_bar'], stability: 3, repRange: [8, 12], restSec: 75 }),
  make({ id: 'ex_db_curl', name: 'Dumbbell Curl', aliases: ['db curl', 'curl manubri'], category: 'isolation', movementPattern: 'biceps', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: ['dumbbell'], stability: 3, repRange: [8, 12], restSec: 75 }),
  make({ id: 'ex_cable_curl', name: 'Cable Curl', aliases: ['curl ai cavi', 'curl cavi'], category: 'isolation', movementPattern: 'biceps', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: ['cable'], stability: 2, repRange: [10, 15], restSec: 75 }),
  make({ id: 'ex_preacher_curl', name: 'Preacher Curl', aliases: ['panca scott'], category: 'isolation', movementPattern: 'biceps', primaryMuscles: ['biceps'], equipment: ['machine', 'ez_bar'], stability: 1, repRange: [8, 12], restSec: 75 }),

  // ---- Triceps ----
  make({ id: 'ex_triceps_pushdown', name: 'Triceps Pushdown', aliases: ['pushdown', 'cable pushdown', 'pushdown ai cavi'], category: 'isolation', movementPattern: 'triceps', primaryMuscles: ['triceps'], equipment: ['cable'], stability: 2, repRange: [10, 15], restSec: 75 }),
  make({ id: 'ex_overhead_triceps_ext', name: 'Overhead Triceps Extension', aliases: ['french press', 'triceps extension'], category: 'isolation', movementPattern: 'triceps', primaryMuscles: ['triceps'], equipment: ['dumbbell', 'cable'], stability: 3, romProfile: 'long', repRange: [10, 15], restSec: 75 }),
  make({ id: 'ex_skullcrusher', name: 'Skullcrusher', aliases: ['lying triceps extension'], category: 'isolation', movementPattern: 'triceps', primaryMuscles: ['triceps'], equipment: ['ez_bar', 'bench'], stability: 3, repRange: [8, 12], restSec: 75 }),
  make({ id: 'ex_dips', name: 'Dips', aliases: ['parallel bar dips', 'parallele'], category: 'compound', movementPattern: 'triceps', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'anterior_deltoid'], equipment: ['bodyweight'], difficulty: 'advanced', stability: 4, repRange: [6, 12], restSec: 120 }),

  // ---- Core ----
  make({ id: 'ex_hanging_leg_raise', name: 'Hanging Leg Raise', category: 'isolation', movementPattern: 'core', primaryMuscles: ['abs'], secondaryMuscles: ['obliques'], equipment: ['pullup_bar', 'bodyweight'], stability: 4, repRange: [8, 15], restSec: 75 }),
  make({ id: 'ex_cable_crunch', name: 'Cable Crunch', category: 'isolation', movementPattern: 'core', primaryMuscles: ['abs'], equipment: ['cable'], stability: 2, repRange: [10, 20], restSec: 75 }),
  make({ id: 'ex_plank', name: 'Plank', category: 'isolation', movementPattern: 'core', primaryMuscles: ['abs'], secondaryMuscles: ['obliques'], equipment: ['bodyweight'], difficulty: 'beginner', stability: 4, repRange: [1, 1], restSec: 60 }),
];

/** Fast lookup used across the app. */
export const EXERCISE_SEED_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_SEED.map((e) => [e.id, e]),
);
