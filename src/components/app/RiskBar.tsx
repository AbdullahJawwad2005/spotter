import { cn } from "@/lib/utils";

export function RiskBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color =
    v > 70 ? "bg-destructive"
    : v > 45 ? "bg-warning"
    : "bg-success";
  const label =
    v > 70 ? "High risk — stop"
    : v > 45 ? "Watch fatigue"
    : "Safe";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Injury risk</span>
        <span className="text-xs tabular text-muted-foreground">{label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 rounded-full", color)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
