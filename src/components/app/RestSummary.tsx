import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Target, ArrowRight, TrendingUp, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { speak, stopSpeaking } from "@/lib/voice";
import { toast } from "sonner";

export interface SetRecord {
  exerciseName: string;
  setIndex: number;
  totalSets: number;
  targetReps: number;
  reps: { score?: number; depth?: number; back?: number; durMs?: number; ok?: boolean }[];
  topCue?: string;
  formScored: boolean;
  /** Optional: avg score from previous set of this exercise — used by coach to read improvement. */
  prevAvgScore?: number;
}

interface SetSummary {
  headline: string;
  didWell: string;
  fellShort: string;
  commonMistake: string;
  improvement: string;
  injuryRisk: "low" | "moderate" | "high";
  injuryRiskNote: string;
  focusNext: string;
}

interface Props {
  set: SetRecord;
  restSec: number;
  isLastSet: boolean;
  onContinue: () => void;
  onSkip: () => void;
}

export function RestSummary({ set, restSec, isLastSet, onContinue, onSkip }: Props) {
  const [summary, setSummary] = useState<SetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(restSec);
  const spokenRef = useRef(false);

  // Fetch summary on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("coach", { body: set });
        if (cancelled) return;
        if (error) throw error;
        const s = (data as { summary?: SetSummary })?.summary;
        if (!s) throw new Error("Empty summary");
        setSummary(s);

        // Read the full debrief aloud once
        if (!spokenRef.current) {
          spokenRef.current = true;
          const riskLine =
            s.injuryRisk === "high" ? `Injury risk high. ${s.injuryRiskNote}`
            : s.injuryRisk === "moderate" ? `Injury risk moderate. ${s.injuryRiskNote}`
            : `Injury risk low.`;
          const fullRead = [
            s.headline + ".",
            "What you did well. " + s.didWell,
            "Where you fell short. " + s.fellShort,
            "Most common mistake. " + s.commonMistake,
            s.improvement,
            riskLine,
            "Focus next set. " + s.focusNext,
          ].join(" ");
          speak(fullRead, { force: true });
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        toast.error(msg.includes("402") ? "Out of AI credits — add some in workspace settings." : "Coach unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rest countdown
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  // Voice cue at 10s left and 0
  useEffect(() => {
    if (remaining === 10) speak("Ten seconds. Get ready.", { force: true });
    if (remaining === 0) speak(isLastSet ? "Workout complete." : "Rest over. Next set.", { force: true });
  }, [remaining, isLastSet]);

  const pct = Math.max(0, Math.min(100, ((restSec - remaining) / restSec) * 100));
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Rest timer */}
      <div className="hairline border-border rounded-xl bg-card p-6 text-center space-y-4">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {isLastSet ? "Workout complete" : "Rest"}
        </div>
        <div className="text-7xl md:text-8xl font-display tabular leading-none">
          {mm}:{ss}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden max-w-md mx-auto">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { stopSpeaking(); onSkip(); }} className="h-9 text-xs">
            Skip rest
          </Button>
          <Button size="sm" onClick={() => { stopSpeaking(); onContinue(); }} disabled={remaining > 0 && !summary} className="h-9 text-xs gap-1.5">
            {isLastSet ? "Finish workout" : "Next set"} <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Coach summary */}
      <div className="hairline border-border rounded-xl bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Coach debrief — {set.exerciseName}, set {set.setIndex} of {set.totalSets}
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reviewing your reps…
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <div className="text-2xl md:text-3xl font-display tracking-tight leading-tight">
              {summary.headline}
            </div>

            <SummaryRow
              icon={CheckCircle2}
              tint="success"
              label="What you did well"
              text={summary.didWell}
            />
            <SummaryRow
              icon={AlertCircle}
              tint="warning"
              label="Where you fell short"
              text={summary.fellShort}
            />
            <SummaryRow
              icon={AlertCircle}
              tint="destructive"
              label="Most common mistake"
              text={summary.commonMistake}
            />
            <SummaryRow
              icon={TrendingUp}
              tint="primary"
              label="Improvement vs last set"
              text={summary.improvement}
            />
            <SummaryRow
              icon={ShieldAlert}
              tint={summary.injuryRisk === "high" ? "destructive" : summary.injuryRisk === "moderate" ? "warning" : "success"}
              label={`Injury risk — ${summary.injuryRisk}`}
              text={summary.injuryRiskNote}
            />
            <SummaryRow
              icon={Target}
              tint="primary"
              label="Focus next set"
              text={summary.focusNext}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  tint,
  label,
  text,
}: {
  icon: typeof CheckCircle2;
  tint: "success" | "warning" | "destructive" | "primary";
  label: string;
  text: string;
}) {
  const cls =
    tint === "success" ? "text-success bg-success/10"
    : tint === "warning" ? "text-warning bg-warning/15"
    : tint === "destructive" ? "text-destructive bg-destructive/10"
    : "text-primary bg-primary/10";
  return (
    <div className="flex gap-3">
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
