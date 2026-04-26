import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SkeletonCanvas } from '@/components/app/SkeletonCanvas';
import { PhaseIndicator } from '@/components/app/PhaseIndicator';
import { StatTile } from '@/components/app/StatTile';
import { RepPills } from '@/components/app/RepPills';
import { RiskBar } from '@/components/app/RiskBar';
import { StopOverlay } from '@/components/app/StopOverlay';
import { WorkoutProgress } from '@/components/app/WorkoutProgress';
import { RepFeedbackList } from '@/components/app/RepFeedbackList';
import { TapRepCounter } from '@/components/app/TapRepCounter';
import { RestSummary, type SetRecord } from '@/components/app/RestSummary';
import { useQuickSession } from '@/hooks/useQuickSession';
import { useMediaPipePose } from '@/hooks/useMediaPipePose';
import { SquatEngine, type RealtimeState } from '@/lib/squat-engine';
import { squatMetrics, type Landmark } from '@/lib/pose-math';
import { speak, tone, primeVoice, stopSpeaking } from '@/lib/voice';
import { FORM_SCORED_EXERCISES } from '@/lib/exercises';
import {
  Camera, Volume2, VolumeX, ArrowLeft,
  Play, Square, Loader2, ShieldCheck, Trophy, Timer, Dumbbell, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SessionPhase = 'ready' | 'lifting' | 'resting' | 'complete';

export default function QuickSession() {
  const navigate = useNavigate();
  const {
    planData, session, loading, error,
    getCurrentExercise, completeSet, skipRest, finishWorkout,
  } = useQuickSession();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('ready');
  const [completedSet, setCompletedSet] = useState<SetRecord | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [formState, setFormState] = useState<RealtimeState>({
    phase: 'standing', repCount: 0, currentDepth: 180, liveScore: 100,
    liveCue: 'Ready', reps: [], riskScore: 0,
  });
  const [liveAngles, setLiveAngles] = useState({ knee: 0, back: 0, asym: 0 });
  const engineRef = useRef(new SquatEngine({ rehab: false }));
  const prevAvgByExercise = useRef<Record<string, number>>({});
  const lastSpokenRep = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const userStartedCamera = useRef(false);
  const autoFinishedRef = useRef(false);
  const prevSessionPhase = useRef<SessionPhase>('ready');

  const current = getCurrentExercise();
  const isFormScored = current
    ? FORM_SCORED_EXERCISES.some((id) => (current.exercise || '').toLowerCase().includes(id))
    : false;

  const currentRestSec = useMemo(() => {
    const restStr = (current as any)?.rest;
    if (!restStr) return 60;
    const match = String(restStr).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
  }, [current]);

  const warmupLen = planData?.warmup?.length || 0;
  const mainLen = planData?.main?.length || 0;
  const totalExercises = warmupLen + mainLen + (planData?.cooldown?.length || 0);
  const progressPercent = session ? (session.exerciseIndex / Math.max(totalExercises, 1)) * 100 : 0;
  const setsCompletedByIndex = session?.exercises.map((e) => e.setsCompleted) || [];
  const planTitle = planData?.title || 'Quick Workout';

  const exerciseIndex = session?.exerciseIndex || 0;
  const setsCompleted = session?.exercises[exerciseIndex]?.setsCompleted || 0;
  const totalSets = (current as any)?.sets || 1;
  const currentSetNum = setsCompleted + 1;

  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { status, error: poseError, start: startPose, stop: stopPose } = useMediaPipePose(
    videoRef as React.RefObject<HTMLVideoElement>,
    (frame) => {
      if (sessionPhase !== 'lifting' || !isFormScored) return;
      setLandmarks(frame.landmarks);
      const m = squatMetrics(frame.worldLandmarks);
      if (m) setLiveAngles({ knee: m.kneeAngle, back: m.backFromVertical, asym: m.asymmetry });
      const next = engineRef.current.update(m, performance.now());
      setFormState({ ...next });
    },
  );

  const cameraReady = status === 'running';

  // Per-rep voice feedback
  useEffect(() => {
    if (sessionPhase !== 'lifting' || !isFormScored || !voiceEnabled) return;
    const last = formState.reps[formState.reps.length - 1];
    if (!last || last.index === lastSpokenRep.current) return;
    lastSpokenRep.current = last.index;
    let line = `${last.index}.`;
    if (last.feedback.severity === 'good') { tone(880, 70); line += ` ${last.feedback.voice}`; }
    else if (last.feedback.severity === 'minor') { tone(560, 90); line += ` ${last.feedback.voice}`; }
    else { tone(320, 130); line += ` ${last.feedback.voice} ${last.feedback.fix}`; }
    speak(line, { force: true });
  }, [formState.reps, sessionPhase, isFormScored, voiceEnabled]);

  // Auto-finish set when target reps reached (form-scored exercises)
  useEffect(() => {
    if (sessionPhase !== 'lifting' || !isFormScored) return;
    const repsRaw = (current as any)?.reps;
    const targetReps = typeof repsRaw === 'number' ? repsRaw : parseInt(String(repsRaw)) || 8;
    if (formState.repCount < targetReps) { autoFinishedRef.current = false; return; }
    if (autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    // Completion tones
    tone(660, 100);
    setTimeout(() => tone(880, 100), 160);
    setTimeout(() => tone(1100, 180), 320);
    // Speak rest duration, then finish the set
    const restSec = currentRestSec;
    const restText = restSec >= 60
      ? `${Math.floor(restSec / 60)} minute${Math.floor(restSec / 60) > 1 ? 's' : ''}`
      : `${restSec} seconds`;
    setTimeout(() => {
      speak(`Set complete! Rest ${restText}.`, { force: true });
      handleFinishSet();
    }, 450);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.repCount, sessionPhase, isFormScored]);

  // Camera auto-restart when entering 'ready' after rest
  useEffect(() => {
    const prev = prevSessionPhase.current;
    prevSessionPhase.current = sessionPhase;
    if (sessionPhase === 'ready' && prev === 'resting') {
      if (userStartedCamera.current && isFormScored && status !== 'running' && status !== 'loading') {
        const t = setTimeout(() => startPose(), 300);
        return () => clearTimeout(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhase, isFormScored]);

  const handleStartCamera = () => {
    primeVoice();
    startPose();
    userStartedCamera.current = true;
  };

  const handleStopCamera = () => {
    stopPose();
    setLandmarks(null);
    userStartedCamera.current = false;
  };

  const handleStartSet = () => {
    primeVoice();
    engineRef.current.reset();
    lastSpokenRep.current = 0;
    autoFinishedRef.current = false;
    setFormState({ phase: 'standing', repCount: 0, currentDepth: 180, liveScore: 100, liveCue: 'Ready', reps: [], riskScore: 0 });
    setLandmarks(null);
    setSessionPhase('lifting');
    const repsRaw = (current as any)?.reps;
    const targetReps = typeof repsRaw === 'number' ? repsRaw : parseInt(String(repsRaw)) || 8;
    if (voiceEnabled) speak(`Set ${currentSetNum} of ${totalSets}. ${targetReps} reps. ${(current as any)?.notes || ''}`);
  };

  const handleFinishSet = (tapReps?: { ok: boolean }[]) => {
    if (!current) return;
    const cueCounts: Record<string, number> = {};
    if (isFormScored) {
      for (const r of formState.reps) for (const c of r.cues || []) cueCounts[c] = (cueCounts[c] ?? 0) + 1;
    }
    const topCue = Object.entries(cueCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const thisAvg = isFormScored && formState.reps.length
      ? Math.round(formState.reps.reduce((s, r) => s + r.score, 0) / formState.reps.length)
      : undefined;
    const prevAvgScore = prevAvgByExercise.current[current.exercise];
    if (thisAvg !== undefined) prevAvgByExercise.current[current.exercise] = thisAvg;

    const repsRaw = (current as any)?.reps;
    const targetReps = typeof repsRaw === 'number' ? repsRaw : parseInt(String(repsRaw)) || 8;

    const record: SetRecord = {
      exerciseName: current.exercise,
      setIndex: currentSetNum,
      totalSets,
      targetReps,
      formScored: isFormScored,
      topCue,
      prevAvgScore,
      reps: isFormScored
        ? formState.reps.map((r) => ({ score: r.score, depth: Math.round(r.depth), back: Math.round(r.maxBackLean), durMs: r.durationMs }))
        : (tapReps || []).map((r) => ({ ok: r.ok })),
    };

    setCompletedSet(record);
    setSessionPhase('resting');
    if (isFormScored) stopPose();
    tone(660, 100);
  };

  const handleContinueAfterRest = () => {
    completeSet();
    setCompletedSet(null);
    setSessionPhase('ready');
  };

  const handleFinishWorkout = async () => {
    await finishWorkout();
    setWorkoutFinished(true);
    tone(660, 120);
    setTimeout(() => tone(880, 120), 150);
    setTimeout(() => tone(1100, 200), 300);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const avgScore = useMemo(() =>
    formState.reps.length ? Math.round(formState.reps.reduce((s, r) => s + r.score, 0) / formState.reps.length) : null,
    [formState.reps]
  );
  const fastest = useMemo(() =>
    formState.reps.length ? Math.min(...formState.reps.map((r) => r.durationMs)) : 0,
    [formState.reps]
  );
  const avgTime = formState.reps.length
    ? Math.round(formState.reps.reduce((s, r) => s + r.durationMs, 0) / formState.reps.length)
    : 0;
  const scoreAccent = formState.liveScore >= 85 ? 'good' : formState.liveScore >= 65 ? 'warn' : 'bad';

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-background"><Navigation />
      <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    </div>
  );

  if (error || !planData) return (
    <div className="min-h-screen bg-background"><Navigation />
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <img src="/SpotterLogo.png" alt="Spotter" className="h-12 w-12 object-contain opacity-40" />
        <p className="text-muted-foreground">{error || 'No workout plan found'}</p>
        <Button onClick={() => navigate('/workout')}>Generate a Workout</Button>
      </div>
    </div>
  );

  // ── Complete ──
  if (workoutFinished || session?.phase === 'done') {
    const mainExercises = session?.exercises.slice(warmupLen, warmupLen + mainLen) || [];
    const completed = mainExercises.filter((e) => e.setsCompleted > 0).length;
    return (
      <div className="min-h-screen bg-background"><Navigation />
        <div className="max-w-lg mx-auto px-6 py-16 text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Trophy className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-display tracking-tight">Workout Complete</h1>
          <p className="text-muted-foreground">{planTitle}</p>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Duration" value={formatTime(elapsed)} />
            <StatTile label="Exercises" value={`${completed}/${mainLen}`} />
            <StatTile label="Scored reps" value={String(formState.repCount || 0)} />
          </div>
          {avgScore !== null && (
            <div className="border border-border rounded-xl p-4">
              <div className="text-sm font-medium mb-1">Avg form score</div>
              <div className={cn('text-3xl font-display', scoreAccent === 'good' ? 'text-success' : scoreAccent === 'warn' ? 'text-warning' : 'text-destructive')}>{avgScore}/100</div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="outline" onClick={() => navigate('/workout')}>New Workout</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active session ──
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Top bar: progress + timer + voice */}
      <div className="border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 h-11 flex items-center gap-4">
          <button onClick={() => navigate('/workout')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
          <div className="flex-1"><Progress value={progressPercent} className="h-1" /></div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />{formatTime(elapsed)}
            </span>
            <button
              onClick={() => { setVoiceEnabled(v => !v); if (voiceEnabled) stopSpeaking(); }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

        {/* ── Left sidebar: workout plan ── */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          {planData && (
            <WorkoutProgress
              planData={planData}
              planTitle={planTitle}
              exerciseIndex={exerciseIndex}
              setsCompletedByIndex={setsCompletedByIndex}
            />
          )}
          <button onClick={handleFinishWorkout}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
            End workout early
          </button>
        </aside>

        {/* ── Right main ── */}
        <section className="space-y-4">

          {/* Exercise header card */}
          {current && (
            <div className="border border-border rounded-xl bg-card p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Exercise {exerciseIndex + 1} of {totalExercises} · Set {currentSetNum} of {totalSets}
                </div>
                <div className="text-2xl font-display mt-1">{current.exercise}</div>
                {(current as any)?.notes && (
                  <div className="text-xs text-muted-foreground mt-1">{(current as any).notes}</div>
                )}
              </div>
              {(current as any)?.sets && (
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Target</div>
                    <div className="text-2xl font-display tabular">{(current as any).reps} reps</div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rest</div>
                    <div className="text-2xl font-display tabular">{(current as any).rest || '60s'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resting: coach debrief */}
          {sessionPhase === 'resting' && completedSet && (
            <RestSummary
              set={completedSet}
              restSec={currentRestSec}
              isLastSet={currentSetNum >= totalSets}
              onContinue={handleContinueAfterRest}
              onSkip={() => { skipRest(); handleContinueAfterRest(); }}
            />
          )}

          {/* Ready / Lifting */}
          {(sessionPhase === 'ready' || sessionPhase === 'lifting') && current && (
            isFormScored ? (
              /* ── Pose-scored: camera + metrics grid ── */
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

                {/* Camera card */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Live form coaching
                    </div>
                    <div className="flex items-center gap-2">
                      {cameraReady && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                        </span>
                      )}
                      {cameraReady ? (
                        <Button size="sm" variant="outline" onClick={handleStopCamera} className="h-8 text-xs gap-1.5">
                          <Square className="h-3 w-3" /> Stop camera
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleStartCamera} disabled={status === 'loading'} className="h-8 text-xs gap-1.5">
                          {status === 'loading'
                            ? <><Loader2 className="h-3 w-3 animate-spin" />Loading model</>
                            : <><Camera className="h-3 w-3" />Start camera</>}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Video always mounted — dark overlay when camera off */}
                  <div className="relative aspect-video bg-black">
                    <video ref={videoRef} playsInline muted
                      className="absolute inset-0 h-full w-full object-cover scale-x-[-1]" />
                    <div className="absolute inset-0 scale-x-[-1]">
                      <SkeletonCanvas landmarks={landmarks} width={1280} height={720} riskScore={formState.riskScore} />
                    </div>
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-3 max-w-sm px-6">
                          <div className="mx-auto h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                            <Camera className="h-5 w-5 text-primary" />
                          </div>
                          <h2 className="text-base font-display text-white">Point your camera at your full body</h2>
                          <p className="text-xs text-white/60">Video is processed entirely in this browser. Nothing is uploaded.</p>
                          {poseError && <p className="text-xs text-destructive">{poseError}</p>}
                        </div>
                      </div>
                    )}
                    {formState.riskScore > 80 && sessionPhase === 'lifting' && <StopOverlay />}
                    {sessionPhase === 'lifting' && cameraReady && (
                      <>
                        <div className="absolute top-4 left-4 border border-border bg-card/85 backdrop-blur-md rounded-lg px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cue</div>
                          <div className="text-sm font-display" key={formState.liveCue}>{formState.liveCue}</div>
                        </div>
                        <div className="absolute bottom-4 left-4">
                          <PhaseIndicator phase={formState.phase} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-success" /> On-device · video never leaves your machine
                    </div>
                    {sessionPhase === 'ready' ? (
                      <Button size="sm" onClick={handleStartSet} disabled={!cameraReady} className="h-8 text-xs gap-1.5">
                        <Play className="h-3 w-3" /> Start set
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleFinishSet()} className="h-8 text-xs gap-1.5">
                        <Check className="h-3 w-3" /> Finish set
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metrics column */}
                <div className="space-y-3">
                  <div className="border border-border rounded-xl bg-card p-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Last rep</div>
                        <div className={cn('text-5xl font-display tabular leading-none mt-1',
                          scoreAccent === 'good' ? 'text-success' : scoreAccent === 'warn' ? 'text-warning' : 'text-destructive'
                        )} key={`s-${formState.reps.length}`}>
                          {formState.reps.length ? formState.liveScore : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Reps</div>
                        <div className="text-3xl font-display tabular" key={`r-${formState.repCount}`}>
                          {formState.repCount}
                        </div>
                      </div>
                    </div>
                    <RepPills reps={formState.reps} />
                    <RiskBar value={formState.riskScore} />
                    {avgScore !== null && (
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Set average <span className="text-foreground tabular ml-1">{avgScore}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <StatTile label="Knee" value={`${Math.round(liveAngles.knee)}°`} />
                    <StatTile label="Back" value={`${Math.round(liveAngles.back)}°`} />
                    <StatTile label="Asym" value={`${Math.round(liveAngles.asym)}°`} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatTile label="Avg" value={avgTime ? `${(avgTime / 1000).toFixed(1)}s` : '—'} hint="rep time" />
                    <StatTile label="Fast" value={fastest ? `${(fastest / 1000).toFixed(1)}s` : '—'} hint="rep" />
                  </div>

                  <RepFeedbackList reps={formState.reps} />
                </div>
              </div>
            ) : (
              /* ── Tap-count exercises ── */
              sessionPhase === 'ready' ? (
                <div className="border border-border rounded-xl bg-card p-8 text-center space-y-5">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Get ready</div>
                  <p className="text-xs text-muted-foreground">
                    Pose scoring is only on for squats. Tap to log each rep — the coach still debriefs during rest.
                  </p>
                  {(current as any)?.sets ? (
                    <Button size="lg" onClick={handleStartSet} className="h-12 gap-2 w-full">
                      <Play className="h-4 w-4" /> Start set {currentSetNum} of {totalSets}
                    </Button>
                  ) : (
                    <Button size="lg" onClick={() => handleFinishSet()} className="h-12 gap-2 w-full">
                      <Check className="h-4 w-4" /> Mark Done
                    </Button>
                  )}
                </div>
              ) : (
                <TapRepCounter
                  exerciseName={current.exercise}
                  cue={(current as any)?.notes || current.exercise}
                  targetReps={(() => {
                    const r = (current as any)?.reps;
                    return typeof r === 'number' ? r : parseInt(String(r)) || 8;
                  })()}
                  onComplete={handleFinishSet}
                />
              )
            )
          )}
        </section>
      </main>
    </div>
  );
}