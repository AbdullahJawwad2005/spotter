import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronLeft, ChevronRight, Dumbbell, CheckCircle2,
  SkipForward, Play, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, startOfWeek, format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type ScheduledWorkout = Database['public']['Tables']['scheduled_workouts']['Row'];

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Schedule — Spotter';
  }, []);

  useEffect(() => {
    if (user) loadWeek();
  }, [user, currentWeekStart]);

  const loadWeek = async () => {
    if (!user) return;
    setLoading(true);

    const startStr = format(currentWeekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true });

    setScheduledWorkouts(data || []);
    setLoading(false);
  };

  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));

  const markCompleted = async (id: string) => {
    await supabase
      .from('scheduled_workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    loadWeek();
  };

  const markSkipped = async (id: string) => {
    await supabase
      .from('scheduled_workouts')
      .update({ status: 'skipped' })
      .eq('id', id);
    loadWeek();
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display tracking-tight">Workout Schedule</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {format(currentWeekStart, 'MMM d')} — {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {dayNames.map((dayName, i) => {
              const date = addDays(currentWeekStart, i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const isToday = dateStr === todayStr;
              const workout = scheduledWorkouts.find((w) => w.scheduled_date === dateStr);

              return (
                <Card
                  key={i}
                  className={cn(
                    "border-border",
                    isToday && "ring-1 ring-primary/20 bg-primary/[0.02]"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[48px]">
                          <div className={cn(
                            "text-xs uppercase tracking-widest",
                            isToday ? "text-primary font-medium" : "text-muted-foreground"
                          )}>
                            {dayName.slice(0, 3)}
                          </div>
                          <div className={cn(
                            "text-lg font-display tabular",
                            isToday ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {date.getDate()}
                          </div>
                        </div>

                        {workout ? (
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              workout.status === 'completed' ? "bg-success/10" :
                              workout.status === 'skipped' ? "bg-muted" :
                              "bg-primary/10"
                            )}>
                              {workout.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : workout.status === 'skipped' ? (
                                <SkipForward className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Dumbbell className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{workout.title}</div>
                              <div className={cn(
                                "text-xs capitalize",
                                workout.status === 'completed' ? "text-success font-medium" :
                                workout.status === 'skipped' ? "text-muted-foreground" :
                                "text-muted-foreground"
                              )}>
                                {workout.status === 'completed'
                                  ? 'Workout complete — great job!'
                                  : workout.status === 'skipped'
                                  ? 'Skipped'
                                  : workout.focus.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Rest day</div>
                        )}
                      </div>

                      {workout && workout.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markSkipped(workout.id)}
                            className="text-muted-foreground"
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markCompleted(workout.id)}
                            className="text-success"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/workout/session/${workout.id}`)}
                            className="gap-1"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Workout
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
