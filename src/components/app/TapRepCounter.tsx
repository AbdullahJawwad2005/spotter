import { useEffect, useState } from "react";
import { Plus, Minus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak, tone } from "@/lib/voice";

interface Props {
  exerciseName: string;
  cue: string;
  targetReps: number;
  onComplete: (reps: { ok: boolean }[]) => void;
}

/** Tap-counted exercise (no pose scoring). Coach gives the cue, user logs reps. */
export function TapRepCounter({ exerciseName, cue, targetReps, onComplete }: Props) {
  const [reps, setReps] = useState(0);

  useEffect(() => {
    speak(`${exerciseName}. ${targetReps} reps. ${cue}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inc = () => {
    setReps((r) => {
      const next = Math.min(targetReps + 5, r + 1);
      tone(880, 60);
      // Count every rep out loud
      let line = `${next}.`;
      if (next === targetReps) line += " Last rep done.";
      else if (next === targetReps - 1) line += " One more.";
      else if (next === Math.ceil(targetReps / 2) && targetReps >= 6) line += " Halfway.";
      speak(line, { force: true });
      return next;
    });
  };
  const dec = () => setReps((r) => Math.max(0, r - 1));

  const finish = () => {
    onComplete(Array.from({ length: reps }, () => ({ ok: true })));
  };

  const pct = Math.min(100, (reps / targetReps) * 100);

  return (
    <div className="hairline border-border rounded-xl bg-card p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Coach cue</div>
        <div className="text-lg font-display">{cue}</div>
      </div>

      <button
        onClick={inc}
        className="w-full aspect-[4/3] rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform select-none hover:bg-primary/90"
      >
        <span className="text-[11px] uppercase tracking-[0.18em] opacity-70">Tap to log rep</span>
        <span className="text-8xl md:text-9xl font-display tabular leading-none">{reps}</span>
        <span className="text-xs opacity-70 tabular">of {targetReps}</span>
      </button>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={dec} className="flex-1 h-10 gap-1.5">
          <Minus className="h-3.5 w-3.5" /> Undo rep
        </Button>
        <Button onClick={finish} disabled={reps === 0} size="sm" className="flex-1 h-10 gap-1.5">
          <Check className="h-3.5 w-3.5" /> Finish set
        </Button>
      </div>
    </div>
  );
}
