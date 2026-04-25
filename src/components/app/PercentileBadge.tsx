import { TrendingUp } from "lucide-react";

export function PercentileBadge({ avgScore }: { avgScore: number | null }) {
  const pct = avgScore == null ? null : Math.max(5, Math.min(98, Math.round(avgScore * 0.95 + 5)));
  return (
    <div className="hairline border-border rounded-lg bg-muted/40 px-3 py-2 flex items-center gap-2">
      <TrendingUp className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs text-muted-foreground">
        {pct == null ? "Form percentile —" : <>Your form is in the <span className="text-foreground tabular font-display">{pct}th</span> percentile this week</>}
      </span>
    </div>
  );
}
