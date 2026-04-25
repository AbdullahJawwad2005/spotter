import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Play, Square, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/app/Navigation";
import { ExerciseSelect } from "@/components/app/ExerciseSelect";
import { ModeToggle } from "@/components/app/ModeToggle";
import { SkeletonCanvas } from "@/components/app/SkeletonCanvas";
import { PhaseIndicator } from "@/components/app/PhaseIndicator";
import { StatTile } from "@/components/app/StatTile";
import { RepPills } from "@/components/app/RepPills";
import { FormDecayChart } from "@/components/app/FormDecayChart";
import { MuscleRadar } from "@/components/app/MuscleRadar";
import { RiskBar } from "@/components/app/RiskBar";
import { PercentileBadge } from "@/components/app/PercentileBadge";
import { CoachPanel } from "@/components/app/CoachPanel";
import { StopOverlay } from "@/components/app/StopOverlay";
import { useMediaPipePose } from "@/hooks/useMediaPipePose";
import { SquatEngine, type RealtimeState } from "@/lib/squat-engine";
import { squatMetrics, type Landmark } from "@/lib/pose-math";
import { EXERCISES, type ExerciseId } from "@/lib/exercises";
import { speak, tone } from "@/lib/voice";

const Trainer = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [exercise, setExercise] = useState<ExerciseId>("squat");
  const [rehab, setRehab] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const engineRef = useRef(new SquatEngine({ rehab: false }));
  const [state, setState] = useState<RealtimeState>({
    phase: "standing", repCount: 0, currentDepth: 180, liveScore: 100,
    liveCue: "Ready", reps: [], riskScore: 0,
  });
  const [liveAngles, setLiveAngles] = useState({ knee: 0, back: 0, asym: 0 });

  // SEO
  useEffect(() => {
    document.title = "FormCheck AI — live rep scoring";
  }, []);

  useEffect(() => {
    engineRef.current.setOptions({ rehab });
  }, [rehab]);

  const { status, error, start, stop } = useMediaPipePose(videoRef, (frame) => {
    setLandmarks(frame.landmarks);
    const m = squatMetrics(frame.worldLandmarks);
    if (m) setLiveAngles({ knee: m.kneeAngle, back: m.backFromVertical, asym: m.asymmetry });
    const next = engineRef.current.update(m, performance.now());
    setState({ ...next });
  });

  // Speak the new rep cue when rep count increments
  const lastSpokenRep = useRef(0);
  useEffect(() => {
    const last = state.reps[state.reps.length - 1];
    if (!last || last.index === lastSpokenRep.current) return;
    lastSpokenRep.current = last.index;
    if (last.score >= 85) {
      tone(880, 70);
    } else {
      tone(360, 110);
      speak(last.primaryCue);
    }
  }, [state.reps]);

  const reset = () => {
    engineRef.current.reset();
    lastSpokenRep.current = 0;
    setState({
      phase: "standing", repCount: 0, currentDepth: 180, liveScore: 100,
      liveCue: "Ready", reps: [], riskScore: 0,
    });
  };

  const stopAll = () => {
    stop();
    setLandmarks(null);
  };

  const ex = EXERCISES[exercise];
  const avgScore = state.reps.length
    ? Math.round(state.reps.reduce((s, r) => s + r.score, 0) / state.reps.length)
    : null;
  const fastest = useMemo(
    () => state.reps.length ? Math.min(...state.reps.map((r) => r.durationMs)) : 0,
    [state.reps],
  );
  const slowest = useMemo(
    () => state.reps.length ? Math.max(...state.reps.map((r) => r.durationMs)) : 0,
    [state.reps],
  );
  const avgTime = state.reps.length
    ? Math.round(state.reps.reduce((s, r) => s + r.durationMs, 0) / state.reps.length)
    : 0;

  const intensity = Math.min(1, state.repCount / 8);
  const scoreAccent = state.liveScore >= 85 ? "good" : state.liveScore >= 65 ? "warn" : "bad";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="border-b hairline border-border">
        <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center justify-end gap-2">
          <ExerciseSelect value={exercise} onChange={(v) => { setExercise(v); reset(); }} />
          <ModeToggle rehab={rehab} onChange={setRehab} />
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Video pane */}
          <section className="hairline border-border rounded-xl bg-card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b hairline border-border">
              <div>
                <div className="text-sm font-display">{ex.name}</div>
                <div className="text-xs text-muted-foreground">{ex.blurb}</div>
              </div>
              <div className="flex items-center gap-2">
                {status === "running" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-ring" />
                    Live
                  </span>
                )}
                {status === "running" ? (
                  <Button size="sm" variant="outline" onClick={stopAll} className="h-8 text-xs gap-1.5">
                    <Square className="h-3 w-3" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={start} disabled={status === "loading"} className="h-8 text-xs gap-1.5">
                    {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {status === "loading" ? "Loading model" : "Start camera"}
                  </Button>
                )}
              </div>
            </div>

            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 scale-x-[-1]">
                <SkeletonCanvas
                  landmarks={landmarks}
                  width={1280}
                  height={720}
                  riskScore={state.riskScore}
                />
              </div>

              {status !== "running" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3 max-w-sm px-6">
                    <div className="mx-auto h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-base font-display text-primary-foreground">Point your camera and start lifting</h2>
                    <p className="text-xs text-primary-foreground/70">
                      Your video is processed entirely in this browser.
                      Nothing is uploaded.
                    </p>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                </div>
              )}

              {state.riskScore > 80 && status === "running" && <StopOverlay />}

              {/* Floating live cue */}
              {status === "running" && (
                <div className="absolute top-4 left-4 hairline border-border bg-card/85 backdrop-blur-md rounded-lg px-3 py-2 animate-fade-in-up">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cue</div>
                  <div className="text-sm font-display text-foreground" key={state.liveCue}>
                    {state.liveCue}
                  </div>
                </div>
              )}
              {status === "running" && (
                <div className="absolute bottom-4 left-4">
                  <PhaseIndicator phase={state.phase} />
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex items-center justify-between border-t hairline border-border">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-success" />
                On-device · video never leaves your machine
              </div>
              <Button size="sm" variant="ghost" onClick={reset} className="h-7 text-xs text-muted-foreground">
                Reset session
              </Button>
            </div>
          </section>

          {/* Right panel — live data */}
          <aside className="space-y-3">
            <div className="hairline border-border rounded-xl bg-card p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Last rep score</div>
                  <div className={`text-5xl font-display tabular leading-none mt-1 ${
                    scoreAccent === "good" ? "text-success" : scoreAccent === "warn" ? "text-warning" : "text-destructive"
                  }`} key={`s-${state.reps.length}`}>
                    {state.reps.length ? state.liveScore : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Reps</div>
                  <div className="text-3xl font-display tabular text-foreground" key={`r-${state.repCount}`}>
                    {state.repCount}
                  </div>
                </div>
              </div>
              <RepPills reps={state.reps} />
              <RiskBar value={state.riskScore} />
              <PercentileBadge avgScore={avgScore} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Knee" value={`${Math.round(liveAngles.knee)}°`} />
              <StatTile label="Back lean" value={`${Math.round(liveAngles.back)}°`} />
              <StatTile label="Asym" value={`${Math.round(liveAngles.asym)}°`} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Avg" value={avgTime ? `${(avgTime / 1000).toFixed(1)}s` : "—"} hint="rep time" />
              <StatTile label="Fast" value={fastest ? `${(fastest / 1000).toFixed(1)}s` : "—"} hint="rep" />
              <StatTile label="Slow" value={slowest ? `${(slowest / 1000).toFixed(1)}s` : "—"} hint="rep" />
            </div>

            <CoachPanel reps={state.reps} exercise={exercise} />
          </aside>
        </div>

        {/* Lower analytics row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="hairline border-border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-display">Form decay</div>
                <div className="text-xs text-muted-foreground">Score per rep across the set</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {state.reps.length >= 3 && (() => {
                  const first = state.reps[0].score;
                  const last = state.reps[state.reps.length - 1].score;
                  const delta = last - first;
                  const cls = delta >= 0 ? "text-success" : "text-warning";
                  return <span className={cls}>{delta >= 0 ? "+" : ""}{delta} pts</span>;
                })()}
              </div>
            </div>
            <FormDecayChart reps={state.reps} />
          </div>

          <div className="hairline border-border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-display">Muscle activation</div>
                <div className="text-xs text-muted-foreground">Trained this set</div>
              </div>
              <div className="text-xs text-muted-foreground">{ex.name}</div>
            </div>
            <MuscleRadar exercise={ex} intensity={intensity} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Trainer;
