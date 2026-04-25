import { cn } from "@/lib/utils";
import type { RepResult } from "@/lib/squat-engine";

function tone(score: number) {
  if (score >= 85) return "bg-success/15 text-success border-success/30";
  if (score >= 65) return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

export function RepPills({ reps }: { reps: RepResult[] }) {
  const last = reps.slice(-8);
  const empty = 8 - last.length;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {last.map((r) => (
        <span
          key={r.index}
          title={`Rep ${r.index} · ${r.score} · ${r.primaryCue}`}
          className={cn(
            "hairline rounded-md px-2 py-1 text-xs tabular font-display animate-fade-in-up",
            tone(r.score),
          )}
        >
          {r.score}
        </span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span
          key={`e-${i}`}
          className="hairline rounded-md px-2 py-1 text-xs text-muted-foreground/40 border-border bg-muted/30 tabular"
        >
          —
        </span>
      ))}
    </div>
  );
}
