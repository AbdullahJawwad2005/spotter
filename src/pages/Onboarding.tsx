import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Dumbbell, Target, Flame, Zap, ChevronRight, ChevronLeft, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Goal = 'strength' | 'muscle' | 'fat_loss' | 'fitness';
type Level = 'beginner' | 'intermediate' | 'advanced';
type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull';
type Equipment = 'full_gym' | 'dumbbells' | 'bodyweight';

const goals: { id: Goal; label: string; desc: string; icon: typeof Dumbbell }[] = [
  { id: 'strength', label: 'Get Stronger', desc: 'Heavy weights, low reps, long rest', icon: Dumbbell },
  { id: 'muscle', label: 'Build Muscle', desc: 'Moderate reps, high volume', icon: Target },
  { id: 'fat_loss', label: 'Burn Fat', desc: 'Higher reps, short rest, metabolic', icon: Flame },
  { id: 'fitness', label: 'Stay Fit', desc: 'Balanced, functional training', icon: Zap },
];

const levels: { id: Level; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: 'New to lifting (< 6 months)' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Consistent 6-24 months' },
  { id: 'advanced', label: 'Advanced', desc: '2+ years, know your way around' },
];

const focuses: { id: Focus; label: string }[] = [
  { id: 'full_body', label: 'Full Body' },
  { id: 'upper', label: 'Upper Body' },
  { id: 'lower', label: 'Lower Body' },
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
];

const equipmentOptions: { id: Equipment; label: string }[] = [
  { id: 'full_gym', label: 'Full Gym' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STEPS = 5;

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [goal, setGoal] = useState<Goal>('fitness');
  const [level, setLevel] = useState<Level>('beginner');
  const [focus, setFocus] = useState<Focus>('full_body');
  const [equipment, setEquipment] = useState<Equipment>('full_gym');
  const [duration, setDuration] = useState(45);
  const [workoutDays, setWorkoutDays] = useState<number[]>([1, 3, 5]);

  const toggleDay = (day: number) => {
    setWorkoutDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Update profile with onboarding data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          goal,
          level,
          focus,
          equipment,
          duration,
          workout_days: workoutDays,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Generate the weekly workout plan
      const { error: fnError } = await supabase.functions.invoke('generate-weekly-plan', {
        body: {
          userId: user.id,
          goal,
          level,
          focus,
          equipment,
          duration,
          workoutDays,
        },
      });

      if (fnError) console.error('Plan generation warning:', fnError);

      await refreshProfile();
      navigate('/dashboard');
    } catch (e) {
      console.error('Onboarding error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return workoutDays.length > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              Step {step + 1} of {STEPS}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(((step + 1) / STEPS) * 100)}%
            </span>
          </div>
          <Progress value={((step + 1) / STEPS) * 100} className="h-1" />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        {/* Step 0: Goal */}
        {step === 0 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <h1 className="text-3xl font-display tracking-tight mb-2">What's your main goal?</h1>
              <p className="text-muted-foreground">We'll tailor your entire plan around this</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "p-5 rounded-xl border text-left transition-all",
                    goal === g.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <g.icon className={cn("h-6 w-6 mb-3", goal === g.id ? "text-primary" : "text-muted-foreground")} />
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Level */}
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <h1 className="text-3xl font-display tracking-tight mb-2">What's your experience level?</h1>
              <p className="text-muted-foreground">This affects exercise selection and volume</p>
            </div>
            <div className="space-y-3">
              {levels.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={cn(
                    "w-full p-5 rounded-xl border text-left transition-all flex items-center justify-between",
                    level === l.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div>
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                  </div>
                  {level === l.id && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Focus + Equipment */}
        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-display tracking-tight mb-2 text-center">Training focus & equipment</h1>
              <p className="text-muted-foreground text-center">What you'll train and what you have access to</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Training Focus</label>
                <div className="flex flex-wrap gap-2">
                  {focuses.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFocus(f.id)}
                      className={cn(
                        "px-4 py-2.5 rounded-lg text-sm transition-all",
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
              <div className="space-y-3">
                <label className="text-sm font-medium">Available Equipment</label>
                <div className="flex flex-wrap gap-2">
                  {equipmentOptions.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEquipment(e.id)}
                      className={cn(
                        "px-4 py-2.5 rounded-lg text-sm transition-all",
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
            </div>
          </div>
        )}

        {/* Step 3: Duration */}
        {step === 3 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <h1 className="text-3xl font-display tracking-tight mb-2">How long are your sessions?</h1>
              <p className="text-muted-foreground">We'll fit the exercises to your time window</p>
            </div>
            <div className="pt-8">
              <div className="text-center mb-6">
                <span className="text-6xl font-display tabular text-primary">{duration}</span>
                <span className="text-xl text-muted-foreground ml-1">min</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]: number[]) => setDuration(v)}
                min={15}
                max={90}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>15 min</span>
                <span>45 min</span>
                <span>90 min</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <h1 className="text-3xl font-display tracking-tight mb-2">Which days do you train?</h1>
              <p className="text-muted-foreground">Select your workout days for the weekly schedule</p>
            </div>
            <div className="flex justify-center gap-2 pt-4">
              {dayLabels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "w-12 h-12 rounded-xl text-sm font-medium transition-all flex items-center justify-center",
                    workoutDays.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {workoutDays.length === 0
                ? 'Select at least one day'
                : `${workoutDays.length} workout day${workoutDays.length > 1 ? 's' : ''} per week`}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="border-t border-border bg-background sticky bottom-0">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {step < STEPS - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isSaving || !canProceed()}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building your plan...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Generate My Plan
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
