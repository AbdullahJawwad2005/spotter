import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, RotateCcw, Loader2, Dumbbell, Play } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];

interface WarmupExercise {
  exercise: string;
  duration: string;
  notes?: string;
}

interface MainExercise {
  exercise: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

interface CooldownExercise {
  exercise: string;
  duration: string;
  notes?: string;
}

interface PlanData {
  title: string;
  warmup: WarmupExercise[];
  main: MainExercise[];
  cooldown: CooldownExercise[];
  tips: string[];
}

export default function WorkoutDetail() {
  const { planId } = useParams<{ planId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledId, setScheduledId] = useState<string | null>(null);

  useEffect(() => {
    if (user && planId) loadPlan();
  }, [user, planId]);

  const loadPlan = async () => {
    if (!user || !planId) return;
    setLoading(true);

    const { data } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPlan(data);
      setPlanData(data.plan_data as unknown as PlanData);

      // Find a pending scheduled workout for this plan
      const { data: scheduled } = await supabase
        .from('scheduled_workouts')
        .select('id')
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: true })
        .limit(1);

      if (scheduled && scheduled.length > 0) {
        setScheduledId(scheduled[0].id);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!plan || !planData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-display mb-2">Workout not found</h2>
          <p className="text-sm text-muted-foreground mb-4">This plan may not exist or you don't have access.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display tracking-tight">{planData.title || plan.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {plan.duration} min
              </span>
              <span className="capitalize">{plan.focus.replace('_', ' ')}</span>
              <span className="capitalize">{plan.level}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {scheduledId && (
              <Button onClick={() => navigate(`/workout/session/${scheduledId}`)} className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Start Workout
              </Button>
            )}
            <Button onClick={() => navigate('/workout')} variant="outline" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              New Plan
            </Button>
          </div>
        </div>

        {/* Warmup */}
        {planData.warmup?.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 border-b border-border bg-muted/30">
              <CardTitle className="text-sm">Warmup</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {planData.warmup.map((ex, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{ex.exercise}</div>
                    {ex.notes && <div className="text-xs text-muted-foreground">{ex.notes}</div>}
                  </div>
                  <div className="text-sm text-muted-foreground">{ex.duration}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main Workout */}
        {planData.main?.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 border-b border-border bg-muted/30">
              <CardTitle className="text-sm">Main Workout</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {planData.main.map((ex, i) => (
                <div key={i} className="px-4 py-4 border-b border-border last:border-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm">{ex.exercise}</div>
                    <div className="text-sm tabular text-muted-foreground">
                      {ex.sets} x {ex.reps}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Rest: {ex.rest}</span>
                    {ex.notes && <span>· {ex.notes}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Cooldown */}
        {planData.cooldown?.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2 border-b border-border bg-muted/30">
              <CardTitle className="text-sm">Cooldown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {planData.cooldown.map((ex, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{ex.exercise}</div>
                    {ex.notes && <div className="text-xs text-muted-foreground">{ex.notes}</div>}
                  </div>
                  <div className="text-sm text-muted-foreground">{ex.duration}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        {planData.tips?.length > 0 && (
          <Card className="border-border p-4">
            <CardTitle className="text-sm mb-2">Tips</CardTitle>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {planData.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
