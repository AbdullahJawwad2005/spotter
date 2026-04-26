import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dumbbell, Play, Calendar, CheckCircle2, SkipForward,
  Flame, Target, Clock, TrendingUp, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type ScheduledWorkout = Database['public']['Tables']['scheduled_workouts']['Row'];
type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];

interface DaySchedule {
  date: Date;
  dayLabel: string;
  dayOfWeek: number;
  isToday: boolean;
  workout: ScheduledWorkout & { plan_data?: WorkoutPlan['plan_data'] } | null;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [todayWorkout, setTodayWorkout] = useState<(ScheduledWorkout & { plan_data?: WorkoutPlan['plan_data'] }) | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<WorkoutPlan['plan_data'] | null>(null);

  useEffect(() => {
    document.title = 'Dashboard — AIGymCoach';
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Get this week's scheduled workouts
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      const { data: scheduled } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .order('scheduled_date', { ascending: true });

      // Build week schedule
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const week: DaySchedule[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const workout = (scheduled || []).find((s) => s.scheduled_date === dateStr) || null;

        week.push({
          date,
          dayLabel: dayNames[i],
          dayOfWeek: i,
          isToday: dateStr === todayStr,
          workout,
        });
      }

      setWeekSchedule(week);

      // Find today's workout
      const todayEntry = week.find((d) => d.isToday);
      if (todayEntry?.workout) {
        setTodayWorkout(todayEntry.workout);

        // Fetch plan data for today's workout
        const { data: plan } = await supabase
          .from('workout_plans')
          .select('plan_data')
          .eq('id', todayEntry.workout.plan_id)
          .maybeSingle();

        if (plan) {
          setPlanData(plan.plan_data);
        }
      }

      // Calculate week stats
      const allThisWeek = scheduled || [];
      const completed = allThisWeek.filter((s) => s.status === 'completed').length;
      const total = allThisWeek.length;

      // Calculate streak (consecutive completed days going back)
      const { data: recentCompleted } = await supabase
        .from('scheduled_workouts')
        .select('scheduled_date, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(30);

      let streak = 0;
      if (recentCompleted && recentCompleted.length > 0) {
        const sorted = recentCompleted.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
        const todayDate = new Date();
        for (const entry of sorted) {
          const entryDate = new Date(entry.scheduled_date);
          const diffDays = Math.floor((todayDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= streak + 1) {
            streak++;
          } else {
            break;
          }
        }
      }

      setWeekStats({ completed, total, streak });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (workoutId: string) => {
    if (!user) return;
    await supabase
      .from('scheduled_workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', workoutId);
    loadDashboard();
  };

  const markSkipped = async (workoutId: string) => {
    if (!user) return;
    await supabase
      .from('scheduled_workouts')
      .update({ status: 'skipped' })
      .eq('id', workoutId);
    loadDashboard();
  };

  const startWorkout = () => {
    if (todayWorkout) {
      navigate(`/workout/session/${todayWorkout.id}`);
    }
  };

  const planJson = planData as Record<string, unknown> | null;
  const mainExercises = (planJson?.main as Array<{ exercise: string; sets: number; reps: string }>) || [];
  const warmupExercises = (planJson?.warmup as Array<{ exercise: string; duration: string }>) || [];

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display tracking-tight">
            {getGreeting()}, {profile?.full_name || 'Athlete'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {todayWorkout
              ? todayWorkout.status === 'completed'
                ? 'Great work today! Your workout is done.'
                : todayWorkout.status === 'skipped'
                ? "Today's workout was skipped. Tomorrow is a new chance."
                : "You have a workout scheduled for today. Let's go!"
              : "No workout scheduled today. Enjoy your rest day!"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-display tabular">{weekStats.completed}/{weekStats.total}</div>
                  <div className="text-xs text-muted-foreground">This week</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-display tabular">{weekStats.streak}</div>
                  <div className="text-xs text-muted-foreground">Day streak</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <div className="text-2xl font-display tabular">{weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : 0}%</div>
                  <div className="text-xs text-muted-foreground">Completion</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* No plan state */}
        {!todayWorkout && !loading && (
          <Card className="border-border">
            <CardContent className="p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-display">No workout scheduled today</h2>
              <p className="text-sm text-muted-foreground">
                Generate a workout plan to get started with your training.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/workout')} className="gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Quick Workout
                </Button>
                <Button variant="outline" onClick={() => navigate('/settings')} className="gap-2">
                  Generate Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's workout card */}
        {todayWorkout && (
          <Card className="border-border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <Dumbbell className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{todayWorkout.title}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{todayWorkout.focus.replace('_', ' ')}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {profile?.duration || 45} min
                      </span>
                    </div>
                  </div>
                </div>
                {todayWorkout.status === 'pending' && (
                  <Button onClick={startWorkout} className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Workout
                  </Button>
                )}
                {todayWorkout.status === 'completed' && (
                  <span className="flex items-center gap-1.5 text-sm text-success font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {todayWorkout.status === 'pending' && mainExercises.length > 0 && (
                <div>
                  {/* Warmup */}
                  {warmupExercises.length > 0 && (
                    <div className="px-5 py-3 border-b border-border">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Warmup</div>
                      {warmupExercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                          <span>{ex.exercise}</span>
                          <span className="text-muted-foreground">{ex.duration}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Main */}
                  <div className="px-5 py-3">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Main Workout</div>
                    {mainExercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-sm font-medium">{ex.exercise}</span>
                        <span className="text-sm tabular text-muted-foreground">
                          {ex.sets} x {ex.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Action buttons */}
                  <div className="px-5 py-3 border-t border-border flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markSkipped(todayWorkout.id)}
                      className="text-muted-foreground gap-1.5"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      Skip
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markCompleted(todayWorkout.id)}
                      className="text-success gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Done
                    </Button>
                  </div>
                </div>
              )}
              {todayWorkout.status === 'pending' && mainExercises.length === 0 && (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  Workout plan is being generated. Check back in a moment.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Week calendar */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                This Week
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {weekStats.completed}/{weekStats.total} completed
              </span>
            </div>
            {weekStats.total > 0 && (
              <Progress value={(weekStats.completed / weekStats.total) * 100} className="h-1 mt-2" />
            )}
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-7 gap-2">
              {weekSchedule.map((day) => (
                <div
                  key={day.dayLabel}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-lg transition-colors",
                    day.isToday && "bg-primary/5 ring-1 ring-primary/20",
                  )}
                >
                  <span className={cn(
                    "text-[10px] uppercase tracking-widest",
                    day.isToday ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {day.dayLabel}
                  </span>
                  <span className={cn(
                    "text-sm font-display tabular",
                    day.isToday ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {day.date.getDate()}
                  </span>
                  {day.workout ? (
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      day.workout.status === 'completed' ? "bg-success" :
                      day.workout.status === 'skipped' ? "bg-muted-foreground/30" :
                      "bg-primary"
                    )} />
                  ) : (
                    <div className="h-2 w-2" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/calendar')}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
          >
            <Calendar className="h-5 w-5 text-primary mb-2" />
            <div className="text-sm font-medium">Full Schedule</div>
            <div className="text-xs text-muted-foreground">View all upcoming workouts</div>
          </button>
          <button
            onClick={() => navigate('/workout')}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
          >
            <Dumbbell className="h-5 w-5 text-primary mb-2" />
            <div className="text-sm font-medium">Quick Workout</div>
            <div className="text-xs text-muted-foreground">Generate a new plan</div>
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
          >
            <Target className="h-5 w-5 text-primary mb-2" />
            <div className="text-sm font-medium">AI Coach</div>
            <div className="text-xs text-muted-foreground">Ask fitness questions</div>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
          >
            <TrendingUp className="h-5 w-5 text-primary mb-2" />
            <div className="text-sm font-medium">Settings</div>
            <div className="text-xs text-muted-foreground">Update your preferences</div>
          </button>
        </div>
      </main>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
