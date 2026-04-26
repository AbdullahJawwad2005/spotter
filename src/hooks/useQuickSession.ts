import { useEffect, useState, useCallback, useRef } from 'react';
import type { PlanData } from '@/hooks/useWorkoutPlan';
import { sortSquatFirst } from '@/lib/exercises';

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

const QUICK_PLAN_KEY = 'fc_quick_plan';
const QUICK_SESSION_KEY = 'fc_session_quick';

export function useQuickSession() {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(QUICK_PLAN_KEY);
    if (!raw) {
      setError('No quick workout plan found. Generate one first.');
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PlanData;
      const pd = { ...parsed, warmup: [], main: sortSquatFirst(parsed.main ?? []) };
      setPlanData(pd);
      initSession(pd);
    } catch {
      setError('Invalid plan data');
    }
    setLoading(false);
  }, []);

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

  const initSession = (pd: PlanData) => {
    const totalExercises = (pd.warmup?.length || 0) + (pd.main?.length || 0) + (pd.cooldown?.length || 0);
    const saved = localStorage.getItem(QUICK_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SessionState;
        if (parsed.phase !== 'done' && parsed.exercises.length === totalExercises) {
          setSession(parsed);
          return;
        }
      } catch { /* fall through */ }
      localStorage.removeItem(QUICK_SESSION_KEY);
    }

    const exercises: ExerciseProgress[] = Array.from({ length: totalExercises }, (_, i) => ({
      exerciseIndex: i,
      setsCompleted: 0,
      repsCompleted: 0,
    }));

    const newSession: SessionState = {
      phase: 'main',
      exerciseIndex: 0,
      setIndex: 0,
      exercises,
      startedAt: new Date().toISOString(),
      restTimer: 0,
      isResting: false,
    };
    setSession(newSession);
    localStorage.setItem(QUICK_SESSION_KEY, JSON.stringify(newSession));
  };

  const persistSession = (s: SessionState) => {
    localStorage.setItem(QUICK_SESSION_KEY, JSON.stringify(s));
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
    if (!session) return;
    localStorage.removeItem(QUICK_SESSION_KEY);
    const doneSession = { ...session, phase: 'done' as const };
    setSession(doneSession);
  }, [session]);

  return {
    planData,
    session,
    loading,
    error,
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