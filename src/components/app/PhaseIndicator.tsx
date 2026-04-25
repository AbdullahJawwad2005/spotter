import { cn } from "@/lib/utils";
import type { Phase } from "@/lib/squat-engine";

const ORDER: Phase[] = ["standing", "descending", "bottom", "ascending"];
const LABEL: Record<Phase, string> = {
  standing: "Standing",
  descending: "Descending",
  bottom: "Bottom",
  ascending: "Ascending",
};

export function PhaseIndicator({ phase }: { phase: Phase }) {
  return (
    <div className="flex items-center gap-1.5 hairline border-border bg-card/85 backdrop-blur-md rounded-md px-2.5 py-1.5">
      {ORDER.map((p) => (
        <div key={p} className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              phase === p ? "bg-primary" : "bg-border",
            )}
          />
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.12em]",
              phase === p ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            {LABEL[p]}
          </span>
        </div>
      ))}
    </div>
  );
}
