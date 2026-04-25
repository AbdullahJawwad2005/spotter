import { cn } from "@/lib/utils";
import { EXERCISES, type ExerciseId } from "@/lib/exercises";

export function ExerciseSelect({ value, onChange }: { value: ExerciseId; onChange: (v: ExerciseId) => void }) {
  return (
    <div className="inline-flex hairline border-border rounded-lg bg-card p-0.5">
      {(Object.keys(EXERCISES) as ExerciseId[]).map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "px-3 py-1.5 text-xs font-display rounded-md transition-colors",
            value === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {EXERCISES[id].name}
        </button>
      ))}
    </div>
  );
}