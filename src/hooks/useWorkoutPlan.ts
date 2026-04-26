import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];

export interface PlanData {
  title: string;
  warmup: Array<{ exercise: string; duration: string; notes?: string }>;
  main: Array<{ exercise: string; sets: number; reps: string; rest: string; notes?: string }>;
  cooldown: Array<{ exercise: string; duration: string; notes?: string }>;
  tips: string[];
}

export function useWorkoutPlan(planId: string | undefined) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && planId) load();
    else setLoading(false);
  }, [user, planId]);

  const load = async () => {
    if (!user || !planId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (err) setError(err.message);
    else if (data) { setPlan(data); setPlanData(data.plan_data as unknown as PlanData); }
    setLoading(false);
  };

  return { plan, planData, loading, error, refetch: load };
}