import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ScheduledWorkout = Database['public']['Tables']['scheduled_workouts']['Row'];

export function useScheduledWorkouts(startDate: string, endDate: string) {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user, startDate, endDate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true });

    if (err) setError(err.message);
    else setWorkouts(data || []);
    setLoading(false);
  };

  const markCompleted = async (id: string) => {
    await supabase.from('scheduled_workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  };

  const markSkipped = async (id: string) => {
    await supabase.from('scheduled_workouts').update({ status: 'skipped' }).eq('id', id);
    await load();
  };

  return { workouts, loading, error, refetch: load, markCompleted, markSkipped };
}