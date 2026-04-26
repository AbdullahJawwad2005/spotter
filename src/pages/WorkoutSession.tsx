import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { useVoiceCoach } from '@/hooks/useVoiceCoach';
import { useMediaPipePose } from '@/hooks/useMediaPipePose';
import { SquatEngine, type RealtimeState } from '@/lib/squat-engine';
import { squatMetrics, type Landmark } from '@/lib/pose-math';
import { speak, tone, primeVoice } from '@/lib/voice';
import { FORM_SCORED_EXERCISES } from '@/lib/exercises';
import {
  Camera, CameraOff, Volume2, VolumeX, ArrowLeft,
  Play, Square, Loader2, ShieldCheck, Trophy, Timer, Dumbbell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SessionPhase = 'ready' | 'lifting' | 'resting' | 'complete';

export default function WorkoutSession() {
  const { scheduledWorkoutId } = useParams<{ scheduledWorkoutId: string }>();
  const navigate = useNavigate();
  const {
    scheduled, planData, session, loading, error,
    getCurrentExercise, completeSet, skipRest, finishWorkout,
  } = useWorkoutSession(scheduledWorkoutId);

  const voice = useVoiceCoach();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
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

  const current = getCurrentExercise();
  const isFormScored = current
    ? FORM_SCORED_EXERCISES.some((id) => (current.exercise || '').toLowerCase().includes(id))
    : false;

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Prime voice on mount
  useEffect(() => { voice.prime(); }, []);

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

  // Per-rep voice feedback
  useEffect(() => {
    if (sessionPhase !== 'lifting' || !isFormScored) return;
    const last = formState.reps[formState.reps.length - 1];
    if (!last || last.index === lastSpokenRep.current) return;
    lastSpokenRep.current = last.index;
    let line = `${last.index}.`;
    if (last.feedback.severity === 'good') { tone(880, 70); line += ` ${last.feedback.voice}`; }
    else if (last.feedback.severity === 'minor') { tone(560, 90); line += ` ${last.feedback.voice}`; }
    else { tone(320, 130); line += ` ${last.feedback.voice} ${last.feedback.fix}`; }
    speak(line, { force: true });
  }, [formState.reps, sessionPhase, isFormScored]);

  const toggleCamera = async () => {
    if (cameraOn) {
      stopPose();
      setCameraOn(false);
      setLandmarks(null);
    } else if (videoRef.current) {
      await startPose();
      setCameraOn(true);
    }
  };

  const handleStartSet = () => {
    primeVoice();
    engineRef.current.reset();
    lastSpokenRep.current = 0;
    setFormState({ phase: 'standing', repCount: 0, currentDepth: 180, liveScore: 100, liveCue: 'Ready', reps: [], riskScore: 0 });
    setLandmarks(null);
    setSessionPhase('lifting');
    const setNum = (session?.exercises[session.exerciseIndex]?.setsCompleted || 0) + 1;
    const totalSets = (current as any)?.sets || 1;
    speak(`Set ${setNum} of ${totalSets}. ${(current as any)?.notes || ''}`);
  };

  const handleFinishSet = (tapReps?: { ok: boolean }[]) => {
    if (!current) return;
    const cueCounts: Record<string, number> = {};
    if (isFormScored) {
      for (const r of formState.reps) {
        for (const c of r.cues || []) cueCounts[c] = (cueCounts[c] ?? 0) + 1;
      }
    }
    const topCue = Object.entries(cueCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const thisAvg = isFormScored && formState.reps.length
      ? Math.round(formState.reps.reduce((s, r) => s + r.score, 0) / formState.reps.length)
      : undefined;
    const prevAvgScore = prevAvgByExercise.current[current.exercise];
    if (thisAvg !== undefined) prevAvgByExercise.current[current.exercise] = thisAvg;

    const setsCompleted = session?.exercises[session.exerciseIndex]?.setsCompleted || 0;
    const totalSets = (current as any)?.sets || 1;

    // Parse reps as number
    const repsRaw = (current as any)?.reps;
    const targetReps = typeof repsRaw === 'number' ? repsRaw : parseInt(String(repsRaw)) || 8;

    const record: SetRecord = {
      exerciseName: current.exercise,
      setIndex: setsCompleted + 1,
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
    // Check if session moved to done after completeSet
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

  const warmupLen = planData?.warmup?.length || 0;
  const mainLen = planData?.main?.length || 0;
  const totalExercises = warmupLen + mainLen + (planData?.cooldown?.length || 0);
  const progressPercent = session ? (session.exerciseIndex / Math.max(totalExercises, 1)) * 100 : 0;
  const setsCompletedByIndex = session?.exercises.map((e) => e.setsCompleted) || [];

  const avgScore = useMemo(() =>
    formState.reps.length
      ? Math.round(formState.reps.reduce((s, r) => s + r.score, 0) / formState.reps.length)
      : null,
    [formState.reps]
  );
  const scoreAccent = formState.liveScore >= 85 ? 'text-success' : formState.liveScore >= 65 ? 'text-warning' : 'text-destructive';

  // ── Loading ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  );

  if (error || !scheduled || !planData) return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Dumbbell className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || 'Workout not found'}</p>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    </div>
  );

  // ── Complete screen ────────────────────────────────────────────
  if (workoutFinished || session?.phase === 'done') {
    const mainExercises = session?.exercises.slice(warmupLen, warmupLen + mainLen) || [];
    const completed = mainExercises.filter((e) => e.setsCompleted > 0).length;
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-lg mx-auto px-6 py-16 text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Trophy className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-display tracking-tight">Workout Complete</h1>
          <p className="text-muted-foreground">{scheduled.title}</p>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Duration" value={formatTime(elapsed)} />
            <StatTile label="Exercises" value={`${completed}/${mainLen}`} />
            <StatTile label="Scored reps" value={String(formState.repCount || 0)} />
          </div>
          {avgScore !== null && (
            <div className="border border-border rounded-xl p-4">
              <div className="text-sm font-medium mb-1">Avg form score</div>
              <div className={cn('text-3xl font-display', scoreAccent)}>{avgScore}/100</div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="outline" onClick={() => navigate('/calendar')}>Schedule</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main session ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Top progress bar */}
      <div className="border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 h-11 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
          <div className="flex-1">
            <Progress value={progressPercent} className="h-1" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              {formatTime(elapsed)}
            </span>
            <button onClick={voice.toggle} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {voice.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Resting: AI debrief + countdown */}
            {sessionPhase === 'resting' && completedSet && (
              <RestSummary
                set={completedSet}
                restSec={60}
                isLastSet={
                  (session?.exercises[session.exerciseIndex]?.setsCompleted || 0) + 1 >=
                  ((current as any)?.sets || 1)
                }
                onContinue={handleContinueAfterRest}
                onSkip={() => { skipRest(); handleContinueAfterRest(); }}
              />
            )}

            {/* Ready / Lifting */}
            {(sessionPhase === 'ready' || sessionPhase === 'lifting') && current && (
              <>
                {/* Video pane */}
                <section className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                    <div>
                      <div className="text-sm font-display">{current.exercise}</div>
                      <div className="text-xs text-muted-foreground">
                        {(current as any)?.sets
                          ? `${(current as any).sets} sets × ${(current as any).reps} · rest ${(current as any).rest}`
                          : (current as any)?.duration || ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sessionPhase === 'lifting' && status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                        </span>
                      )}
                      {isFormScored && (
                        <button
                          onClick={toggleCamera}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                            cameraOn ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {cameraOn ? <Camera className="h-3.5 w-3.5" /> : <CameraOff className="h-3.5 w-3.5" />}
                          {cameraOn ? 'Camera on' : 'Camera off'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Camera view */}
                  {cameraOn && isFormScored ? (
                    <div className="relative aspect-video bg-black">
                      <video ref={videoRef} playsInline muted
                        className="absolute inset-0 h-full w-full object-cover scale-x-[-1]" />
                      <div className="absolute inset-0 scale-x-[-1]">
                        <SkeletonCanvas landmarks={landmarks} width={1280} height={720} riskScore={formState.riskScore} />
                      </div>
                      {formState.riskScore > 80 && sessionPhase === 'lifting' && <StopOverlay />}
                      {sessionPhase === 'lifting' && (
                        <>
                          <div className="absolute top-4 left-4 border border-border bg-card/85 backdrop-blur-md rounded-lg px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cue</div>
                            <div className="text-sm font-display">{formState.liveCue}</div>
                          </div>
                          <div className="absolute bottom-4 left-4">
                            <PhaseIndicator phase={formState.phase} />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center">
                      <div className="text-center space-y-3 px-6">
                        <Camera className="h-10 w-10 text-white/30 mx-auto" />
                        <p className="text-sm text-white/50">
                          {isFormScored ? 'Enable camera for live form scoring' : 'Tap-count mode — no pose analysis'}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/40 justify-center">
                          <ShieldCheck className="h-3 w-3" /> On-device · video never leaves your machine
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-3 border-t border-border flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-success" /> On-device processing
                    {poseError && <span className="ml-auto text-destructive normal-case">{poseError}</span>}
                  </div>
                </section>

                {/* Ready: start set button */}
                {sessionPhase === 'ready' && (
                  <div className="border border-border rounded-xl bg-card p-5 space-y-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                        {(current as any)?.phase === 'warmup' ? 'Warmup' : (current as any)?.phase === 'cooldown' ? 'Cooldown' : 'Main Workout'}
                      </div>
                      <h2 className="text-xl font-display">{current.exercise}</h2>
                      {(current as any)?.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{(current as any).notes}</p>
                      )}
                    </div>
                    {(current as any)?.sets ? (
                      <Button onClick={handleStartSet} className="w-full h-12 gap-2">
                        <Play className="h-5 w-5" />
                        Start Set {(session?.exercises[session.exerciseIndex]?.setsCompleted || 0) + 1} of {(current as any).sets}
                      </Button>
                    ) : (
                      <Button onClick={() => handleFinishSet()} className="w-full h-12 gap-2">
                        <Play className="h-5 w-5" />
                        Mark Done
                      </Button>
                    )}
                  </div>
                )}

                {/* Lifting: form-scored → live score panel; non-form-scored → TapRepCounter */}
                {sessionPhase === 'lifting' && (
                  <>
                    {isFormScored ? (
                      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live score</div>
                            <div className={cn('text-5xl font-display tabular leading-none mt-1', scoreAccent)}>
                              {formState.reps.length ? formState.liveScore : '—'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Reps</div>
                            <div className="text-3xl font-display tabular">{formState.repCount}</div>
                          </div>
                        </div>
                        <RepPills reps={formState.reps} />
                        <RiskBar value={formState.riskScore} />
                        <Button onClick={() => handleFinishSet()} variant="outline" className="w-full gap-2">
                          <Square className="h-4 w-4" /> Finish Set
                        </Button>
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
                    )}
                  </>
                )}
              </>
            )}

            {/* End workout button */}
            <div className="pt-2 pb-8">
              <Button variant="outline" onClick={handleFinishWorkout} className="w-full gap-2 text-muted-foreground">
                End Workout
              </Button>
            </div>
          </div>

          {/* ── Right column ── */}
          <aside className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">
            {planData && (
              <WorkoutProgress
                planData={planData}
                planTitle={scheduled.title}
                exerciseIndex={session?.exerciseIndex || 0}
                setsCompletedByIndex={setsCompletedByIndex}
              />
            )}

            {/* Live angle stats during form-scored lifting */}
            {sessionPhase === 'lifting' && isFormScored && (
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Knee" value={`${Math.round(liveAngles.knee)}°`} />
                <StatTile label="Back" value={`${Math.round(liveAngles.back)}°`} />
                <StatTile label="Asym" value={`${Math.round(liveAngles.asym)}°`} />
              </div>
            )}

            <RepFeedbackList reps={formState.reps} />
          </aside>
        </div>
      </main>
    </div>
  );
}