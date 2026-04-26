import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PlanData } from '@/hooks/useWorkoutPlan';
import type { Database } from '@/integrations/supabase/types';

type ScheduledWorkout = Database['public']['Tables']['scheduled_workouts']['Row'];

export interface ExerciseProgress {
  exerciseIndex: number;
  setsCompleted: number;
  repsCompleted: number;
}

export interface SessionState {
  phase: 'warmup' | 'main' | 'cooldown' | 'done';
  exerciseIndex: number;
  setIndex: number;
  exercises: ExerciseProgress[];
  startedAt: string;
  restTimer: number;
  isResting: boolean;
}

const STORAGE_PREFIX = 'fc_session_';

function sessionKey(scheduledWorkoutId: string) {
  return `${STORAGE_PREFIX}${scheduledWorkoutId}`;
}

export function useWorkoutSession(scheduledWorkoutId: string | undefined) {
  const { user } = useAuth();
  const [scheduled, setScheduled] = useState<ScheduledWorkout | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load scheduled workout + plan data
  useEffect(() => {
    if (!user || !scheduledWorkoutId) { setLoading(false); return; }
    loadSession();
  }, [user, scheduledWorkoutId]);

  // Rest timer countdown
  useEffect(() => {
    if (!session?.isResting) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = prev.restTimer - 1;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return { ...prev, restTimer: 0, isResting: false };
        }
        return { ...prev, restTimer: next };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.isResting]);

  const loadSession = async () => {
    if (!user || !scheduledWorkoutId) return;
    setLoading(true);
    setError(null);

    const { data: sw, error: err1 } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('id', scheduledWorkoutId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (err1 || !sw) {
      setError(err1?.message || 'Workout not found');
      setLoading(false);
      return;
    }
    setScheduled(sw);

    const { data: plan } = await supabase
      .from('workout_plans')
      .select('plan_data')
      .eq('id', sw.plan_id)
      .maybeSingle();

    if (plan?.plan_data) {
      const pd = plan.plan_data as unknown as PlanData;
      setPlanData(pd);
      initSession(pd, scheduledWorkoutId);
    } else {
      setError('Plan data not found');
    }
    setLoading(false);
  };

  const initSession = (pd: PlanData, swId: string) => {
    // Check localStorage for existing session
    const saved = localStorage.getItem(sessionKey(swId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SessionState;
        if (parsed.phase !== 'done') {
          setSession(parsed);
          return;
        }
      } catch { /* fall through */ }
    }

    const totalExercises = (pd.warmup?.length || 0) + (pd.main?.length || 0) + (pd.cooldown?.length || 0);
    const exercises: ExerciseProgress[] = Array.from({ length: totalExercises }, (_, i) => ({
      exerciseIndex: i,
      setsCompleted: 0,
      repsCompleted: 0,
    }));

    const newSession: SessionState = {
      phase: 'warmup',
      exerciseIndex: 0,
      setIndex: 0,
      exercises,
      startedAt: new Date().toISOString(),
      restTimer: 0,
      isResting: false,
    };
    setSession(newSession);
    persistSession(newSession, swId);
  };

  const persistSession = (s: SessionState, swId?: string) => {
    const id = swId || scheduledWorkoutId;
    if (id) localStorage.setItem(sessionKey(id), JSON.stringify(s));
  };

  const getCurrentExercise = useCallback(() => {
    if (!planData || !session) return null;
    const warmupLen = planData.warmup?.length || 0;
    const mainLen = planData.main?.length || 0;
    const idx = session.exerciseIndex;

    if (idx < warmupLen) {
      return { ...planData.warmup[idx], phase: 'warmup' as const, totalSets: 1 };
    } else if (idx < warmupLen + mainLen) {
      const mainIdx = idx - warmupLen;
      return { ...planData.main[mainIdx], phase: 'main' as const };
    } else {
      const coolIdx = idx - warmupLen - mainLen;
      return { ...planData.cooldown[coolIdx], phase: 'cooldown' as const, totalSets: 1 };
    }
  }, [planData, session]);

  const completeSet = useCallback(() => {
    if (!session || !planData) return;
    const warmupLen = planData.warmup?.length || 0;
    const mainLen = planData.main?.length || 0;
    const idx = session.exerciseIndex;
    const isMain = idx >= warmupLen && idx < warmupLen + mainLen;
    const current = getCurrentExercise();
    if (!current) return;

    const newExercises = [...session.exercises];
    newExercises[idx] = {
      ...newExercises[idx],
      setsCompleted: newExercises[idx].setsCompleted + 1,
    };

    const totalSets = isMain ? (current as { sets: number }).sets : 1;
    const isLastSet = newExercises[idx].setsCompleted >= totalSets;

    if (isLastSet) {
      // Move to next exercise
      const totalExercises = warmupLen + mainLen + (planData.cooldown?.length || 0);
      const nextIdx = idx + 1;
      let nextPhase: SessionState['phase'] = session.phase;

      if (nextIdx >= totalExercises) {
        nextPhase = 'done';
      } else if (nextIdx < warmupLen) {
        nextPhase = 'warmup';
      } else if (nextIdx < warmupLen + mainLen) {
        nextPhase = 'main';
      } else {
        nextPhase = 'cooldown';
      }

      const restSec = isMain ? parseRest((current as { rest: string }).rest) : 0;
      const newSession: SessionState = {
        ...session,
        phase: nextPhase,
        exerciseIndex: nextIdx >= totalExercises ? idx : nextIdx,
        setIndex: 0,
        exercises: newExercises,
        restTimer: restSec,
        isResting: restSec > 0,
      };
      setSession(newSession);
      persistSession(newSession);
    } else {
      // Next set of same exercise
      const restSec = isMain ? parseRest((current as { rest: string }).rest) : 0;
      const newSession: SessionState = {
        ...session,
        setIndex: session.setIndex + 1,
        exercises: newExercises,
        restTimer: restSec,
        isResting: restSec > 0,
      };
      setSession(newSession);
      persistSession(newSession);
    }
  }, [session, planData, getCurrentExercise]);

  const skipRest = useCallback(() => {
    if (!session) return;
    const newSession = { ...session, restTimer: 0, isResting: false };
    setSession(newSession);
    persistSession(newSession);
  }, [session]);

  const finishWorkout = useCallback(async () => {
    if (!user || !scheduled || !session) return;
    const warmupLen = planData?.warmup?.length || 0;
    const mainLen = planData?.main?.length || 0;
    const mainExercises = session.exercises.slice(warmupLen, warmupLen + mainLen);
    const completed = mainExercises.filter((e) => e.setsCompleted > 0).length;

    // Create workout log
    const { data: logData } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        scheduled_workout_id: scheduled.id,
        plan_id: scheduled.plan_id,
        started_at: session.startedAt,
        finished_at: new Date().toISOString(),
        exercises_completed: completed,
        notes: '',
      })
      .select('id')
      .single();

    if (logData) setLogId(logData.id);

    // Mark scheduled workout as completed
    await supabase
      .from('scheduled_workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', scheduled.id);

    // Clear localStorage
    if (scheduledWorkoutId) localStorage.removeItem(sessionKey(scheduledWorkoutId));

    const doneSession = { ...session, phase: 'done' as const };
    setSession(doneSession);
  }, [user, scheduled, session, planData, scheduledWorkoutId]);

  return {
    scheduled,
    planData,
    session,
    loading,
    error,
    logId,
    getCurrentExercise,
    completeSet,
    skipRest,
    finishWorkout,
  };
}

function parseRest(rest: string): number {
  if (!rest) return 60;
  const match = rest.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 60;
}
