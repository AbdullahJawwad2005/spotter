import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { RepResult } from "@/lib/squat-engine";
import type { ExerciseId } from "@/lib/exercises";
import { toast } from "sonner";

const HISTORY_KEY = "fc_history_v1";

interface SessionSummary {
  exercise: ExerciseId;
  date: string;
  reps: number;
  avgScore: number;
  topCue: string;
}

export function CoachPanel({ reps, exercise }: { reps: RepResult[]; exercise: ExerciseId }) {
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!reps.length) {
      toast("Do a few reps first.");
      return;
    }
    setLoading(true);
    setResponse("");
    const avgScore = Math.round(reps.reduce((s, r) => s + r.score, 0) / reps.length);
    const cueCounts: Record<string, number> = {};
    for (const r of reps) for (const c of r.cues) cueCounts[c] = (cueCounts[c] ?? 0) + 1;
    const topCue = Object.entries(cueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "consistent form";

    let history: SessionSummary[] = [];
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch { /* ignore */ }

    try {
      const { data, error } = await supabase.functions.invoke("coach", {
        body: {
          exercise,
          session: {
            avgScore,
            reps: reps.map((r) => ({ score: r.score, depth: Math.round(r.depth), back: Math.round(r.maxBackLean), durMs: r.durationMs })),
            topCue,
          },
          history: history.slice(-5),
        },
      });
      if (error) throw error;
      const text = (data as { text?: string })?.text ?? "";
      if (!text) throw new Error("Empty coaching response");
      setResponse(text);

      const next: SessionSummary[] = [
        ...history,
        { exercise, date: new Date().toISOString(), reps: reps.length, avgScore, topCue },
      ].slice(-20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Coach unavailable.";
      toast.error(msg.includes("402") ? "Out of AI credits — add some in workspace settings." : "Coach unavailable. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hairline border-border rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">AI coach</span>
        </div>
        <Button size="sm" variant="default" onClick={ask} disabled={loading} className="h-7 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Get feedback"}
        </Button>
      </div>
      {response ? (
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap animate-fade-in-up">
          {response}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Finish your set and tap <span className="text-foreground">Get feedback</span> for an NSCA-grade summary that references your specific reps and tracks progress across sessions.
        </p>
      )}
    </div>
  );
}
