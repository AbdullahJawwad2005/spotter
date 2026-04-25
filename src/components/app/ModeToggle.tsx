import { cn } from "@/lib/utils";
import { HeartPulse, Dumbbell } from "lucide-react";

export function ModeToggle({ rehab, onChange }: { rehab: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex hairline border-border rounded-lg bg-card p-0.5">
      <button
        onClick={() => onChange(false)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-display rounded-md transition-colors",
          !rehab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Dumbbell className="h-3 w-3" /> Train
      </button>
      <button
        onClick={() => onChange(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-display rounded-md transition-colors",
          rehab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <HeartPulse className="h-3 w-3" /> Rehab
      </button>
    </div>
  );
}
