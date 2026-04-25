import { AlertOctagon } from "lucide-react";

export function StopOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-destructive/15 backdrop-blur-[1px] animate-fade-in-up">
      <div className="hairline border-destructive/40 bg-card px-5 py-4 rounded-xl flex items-center gap-3 shadow-sm">
        <AlertOctagon className="h-5 w-5 text-destructive" />
        <div>
          <div className="font-display text-foreground">Stop the set</div>
          <div className="text-xs text-muted-foreground">Form is breaking down — rest before continuing.</div>
        </div>
      </div>
    </div>
  );
}
