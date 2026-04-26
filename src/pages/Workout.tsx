import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Dumbbell, Clock, RotateCcw, Flame, Target, Zap, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type Goal = 'strength' | 'muscle' | 'fat_loss' | 'fitness';
type Level = 'beginner' | 'intermediate' | 'advanced';
type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull';
type Equipment = 'full_gym' | 'dumbbells' | 'bodyweight';

interface WorkoutPlan {
  title: string;
  warmup: Array<{ exercise: string; duration: string; notes?: string }>;
  main: Array<{ exercise: string; sets: number; reps: string; rest: string; notes?: string }>;
  cooldown: Array<{ exercise: string; duration: string; notes?: string }>;
  tips: string[];
}

const goals: { id: Goal; label: string; desc: string; icon: typeof Dumbbell }[] = [
  { id: 'strength', label: 'Get Stronger', desc: 'Heavy, low reps', icon: Dumbbell },
  { id: 'muscle', label: 'Build Muscle', desc: 'Moderate reps, volume', icon: Target },
  { id: 'fat_loss', label: 'Burn Fat', desc: 'Higher reps, short rest', icon: Flame },
  { id: 'fitness', label: 'Stay Fit', desc: 'Balanced session', icon: Zap },
];

const levels: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const focuses: { id: Focus; label: string }[] = [
  { id: 'full_body', label: 'Full body' },
  { id: 'upper', label: 'Upper' },
  { id: 'lower', label: 'Lower' },
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
];

const equipmentOptions: { id: Equipment; label: string }[] = [
  { id: 'full_gym', label: 'Full gym' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

export default function Workout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal>((profile?.goal as Goal) || 'fitness');
  const [level, setLevel] = useState<Level>((profile?.level as Level) || 'beginner');
  const [focus, setFocus] = useState<Focus>((profile?.focus as Focus) || 'full_body');
  const [equipment, setEquipment] = useState<Equipment>((profile?.equipment as Equipment) || 'full_gym');
  const [duration, setDuration] = useState(profile?.duration || 45);
  const [isLoading, setIsLoading] = useState(false);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Workout Planner — AIGymCoach';
  }, []);

  const generateWorkout = async () => {
    if (!user) return;
    setIsLoading(true);
    setWorkout(null);
    setGenError(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-workout', {
        body: { goal, level, focus, equipment, duration },
      });

      if (error) throw error;
      setWorkout(data as WorkoutPlan);

      // Save the plan to the database
      const { data: planData } = await supabase
        .from('workout_plans')
        .insert({
          user_id: user.id,
          title: (data as WorkoutPlan).title,
          goal,
          level,
          focus,
          equipment,
          duration,
          plan_data: data,
        })
        .select('id')
        .single();

      if (planData) setSavedPlanId(planData.id);

      // Save to localStorage for quick session (clear old session so it starts fresh)
      localStorage.setItem('fc_quick_plan', JSON.stringify(data));
      localStorage.removeItem('fc_session_quick');
    } catch (e) {
      console.error(e);
      setGenError(e instanceof Error ? e.message : 'Failed to generate workout. Check that your edge functions are deployed and ANTHROPIC_API_KEY is set.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!workout ? (
          <div className="space-y-8">
            <div className="text-center max-w-xl mx-auto">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">
                Quick Workout Builder
              </div>
              <h1 className="text-3xl md:text-4xl font-display tracking-tight mb-4">
                Build a workout in 15 seconds.
              </h1>
              <p className="text-muted-foreground">
                Pick a goal, level and focus. The AI coach assembles an exercise list
                with sets, reps, rest and cues.
              </p>
            </div>

            {/* Goal Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Goal</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      goal === g.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    <g.icon className={cn("h-5 w-5 mb-2", goal === g.id ? "text-primary" : "text-muted-foreground")} />
                    <div className="font-medium text-sm">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Experience</label>
              <div className="flex gap-2">
                {levels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-all",
                      level === l.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border hover:bg-muted"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Focus</label>
              <div className="flex flex-wrap gap-2">
                {focuses.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFocus(f.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-all",
                      focus === f.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border hover:bg-muted"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Equipment</label>
              <div className="flex gap-2">
                {equipmentOptions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEquipment(e.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-all",
                      equipment === e.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border hover:bg-muted"
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Time available</label>
                <span className="text-sm text-muted-foreground">{duration} min</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]: number[]) => setDuration(v)}
                min={15}
                max={90}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15</span><span>30</span><span>45</span><span>60</span><span>90</span>
              </div>
            </div>

            {genError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {genError}
              </div>
            )}

            <Button onClick={generateWorkout} disabled={isLoading} className="w-full h-12 text-base">
              {isLoading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generating plan...</>
              ) : (
                'Generate plan'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display tracking-tight">{workout.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {duration} min</span>
                  <span className="capitalize">{focus.replace('_', ' ')}</span>
                  <span className="capitalize">{level}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWorkout(null)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> New workout
                </Button>
                <Button onClick={() => navigate('/session/quick')} className="gap-2">
                  <Play className="h-4 w-4" /> Start Session
                </Button>
              </div>
            </div>

            {/* Warmup */}
            {workout.warmup?.length > 0 && (
              <section className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="font-medium text-sm">Warmup</h2>
                </div>
                <div className="divide-y divide-border">
                  {workout.warmup.map((ex, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{ex.exercise}</div>
                        {ex.notes && <div className="text-xs text-muted-foreground">{ex.notes}</div>}
                      </div>
                      <div className="text-sm text-muted-foreground">{ex.duration}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Main Workout */}
            {workout.main?.length > 0 && (
              <section className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="font-medium text-sm">Main Workout</h2>
                </div>
                <div className="divide-y divide-border">
                  {workout.main.map((ex, i) => (
                    <div key={i} className="px-4 py-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm">{ex.exercise}</div>
                        <div className="text-sm tabular text-muted-foreground">{ex.sets} x {ex.reps}</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Rest: {ex.rest}</span>
                        {ex.notes && <span>· {ex.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cooldown */}
            {workout.cooldown?.length > 0 && (
              <section className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="font-medium text-sm">Cooldown</h2>
                </div>
                <div className="divide-y divide-border">
                  {workout.cooldown.map((ex, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{ex.exercise}</div>
                        {ex.notes && <div className="text-xs text-muted-foreground">{ex.notes}</div>}
                      </div>
                      <div className="text-sm text-muted-foreground">{ex.duration}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tips */}
            {workout.tips?.length > 0 && (
              <section className="border border-border rounded-xl bg-card p-4">
                <h2 className="font-medium text-sm mb-2">Tips</h2>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {workout.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary">·</span>{tip}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
