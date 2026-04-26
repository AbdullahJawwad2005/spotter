import { CheckCircle2, AlertTriangle, AlertCircle, Volume2 } from "lucide-react";
import type { RepResult } from "@/lib/squat-engine";
import { speak, primeVoice } from "@/lib/voice";
import { cn } from "@/lib/utils";

const ICON = {
  good: CheckCircle2,
  minor: AlertTriangle,
  major: AlertCircle,
} as const;

const TINT = {
  good: "text-success bg-success/10 border-success/30",
  minor: "text-warning bg-warning/10 border-warning/30",
  major: "text-destructive bg-destructive/10 border-destructive/30",
} as const;

const SCORE_TINT = {
  good: "text-success",
  minor: "text-warning",
  major: "text-destructive",
} as const;

export function RepFeedbackList({ reps }: { reps: RepResult[] }) {
  if (!reps.length) {
    return (
      <div className="hairline border-border rounded-xl bg-card p-4">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          Per-rep feedback
        </div>
        <p className="text-xs text-muted-foreground">
          Each rep will appear here with what to fix and how to fix it.
        </p>
      </div>
    );
  }

  // Show newest first so user always sees their latest rep at the top.
  const ordered = [...reps].slice(-10).reverse();

  return (
    <div className="hairline border-border rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Per-rep feedback
        </div>
        <div className="text-[10px] text-muted-foreground tabular">
          {reps.length} {reps.length === 1 ? "rep" : "reps"}
        </div>
      </div>

      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {ordered.map((r) => {
          const sev = r.feedback.severity;
          const Icon = ICON[sev];
          return (
            <li
              key={r.index}
              className={cn(
                "rounded-lg border p-3 animate-fade-in-up",
                TINT[sev],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-display text-foreground">
                      Rep {r.index} · {r.feedback.issue}
                    </div>
                    <div className={cn("text-base font-display tabular", SCORE_TINT[sev])}>
                      {r.score}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/85">
                    {r.feedback.fix}
                  </p>
                  <button
                    type="button"
                    onClick={() => { primeVoice(); speak(r.feedback.fix, { force: true }); }}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Hear feedback for rep ${r.index}`}
                  >
                    <Volume2 className="h-3 w-3" /> Hear it again
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
