export type ExerciseId = "squat" | "deadlift" | "bench";

export interface Exercise {
  id: ExerciseId;
  name: string;
  blurb: string;
  muscles: { label: string; weight: number }[]; // 0-1
}

/** Exercise IDs that support AI pose-based form scoring. */
export const FORM_SCORED_EXERCISES: ExerciseId[] = ["squat"];

export const EXERCISES: Record<ExerciseId, Exercise> = {
  squat: {
    id: "squat",
    name: "Squat",
    blurb: "Hip hinge below parallel, drive through midfoot.",
    muscles: [
      { label: "Quads", weight: 0.95 },
      { label: "Glutes", weight: 0.85 },
      { label: "Core", weight: 0.55 },
      { label: "Hamstrings", weight: 0.5 },
      { label: "Calves", weight: 0.35 },
      { label: "Back", weight: 0.6 },
    ],
  },
  deadlift: {
    id: "deadlift",
    name: "Deadlift",
    blurb: "Bar over midfoot, neutral spine, hinge at the hip.",
    muscles: [
      { label: "Glutes", weight: 0.95 },
      { label: "Hamstrings", weight: 0.9 },
      { label: "Back", weight: 0.85 },
      { label: "Core", weight: 0.7 },
      { label: "Quads", weight: 0.45 },
      { label: "Forearms", weight: 0.55 },
    ],
  },
  bench: {
    id: "bench",
    name: "Bench press",
    blurb: "Tight upper back, bar to lower chest, full lockout.",
    muscles: [
      { label: "Chest", weight: 0.95 },
      { label: "Triceps", weight: 0.75 },
      { label: "Shoulders", weight: 0.7 },
      { label: "Core", weight: 0.4 },
      { label: "Back", weight: 0.45 },
      { label: "Forearms", weight: 0.35 },
    ],
  },
};

/** Reorders a main-exercise array so the plain "Squat" always comes first (exact match only). */
export function sortSquatFirst<T extends { exercise: string }>(exercises: T[]): T[] {
  return [...exercises].sort((a, b) => {
    const aIsSquat = a.exercise.toLowerCase().trim() === 'squat';
    const bIsSquat = b.exercise.toLowerCase().trim() === 'squat';
    if (aIsSquat && !bIsSquat) return -1;
    if (!aIsSquat && bIsSquat) return 1;
    return 0;
  });
}
