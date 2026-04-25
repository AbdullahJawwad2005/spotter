import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "good" | "warn" | "bad";
  className?: string;
}

export function StatTile({ label, value, hint, accent = "default", className }: Props) {
  const accentClass =
    accent === "good" ? "text-success"
    : accent === "warn" ? "text-warning"
    : accent === "bad" ? "text-destructive"
    : "text-foreground";
  return (
    <div className={cn("hairline border-border rounded-lg bg-card px-4 py-3 flex flex-col gap-1", className)}>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-display tabular leading-none animate-ticker", accentClass)} key={value}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground tabular">{hint}</span>}
    </div>
  );
}