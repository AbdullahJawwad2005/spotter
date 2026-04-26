import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Goal = 'strength' | 'muscle' | 'fat_loss' | 'fitness';
type Level = 'beginner' | 'intermediate' | 'advanced';
type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull';
type Equipment = 'full_gym' | 'dumbbells' | 'bodyweight';

const goals: { id: Goal; label: string }[] = [
  { id: 'strength', label: 'Get Stronger' },
  { id: 'muscle', label: 'Build Muscle' },
  { id: 'fat_loss', label: 'Burn Fat' },
  { id: 'fitness', label: 'Stay Fit' },
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

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [goal, setGoal] = useState<Goal>((profile?.goal as Goal) || 'fitness');
  const [level, setLevel] = useState<Level>((profile?.level as Level) || 'beginner');
  const [focus, setFocus] = useState<Focus>((profile?.focus as Focus) || 'full_body');
  const [equipment, setEquipment] = useState<Equipment>((profile?.equipment as Equipment) || 'full_gym');
  const [duration, setDuration] = useState(profile?.duration || 45);
  const [workoutDays, setWorkoutDays] = useState<number[]>(profile?.workout_days || [1, 3, 5]);

  const toggleDay = (day: number) => {
    setWorkoutDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          goal,
          level,
          focus,
          equipment,
          duration,
          workout_days: workoutDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Settings saved');
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!user) return;
    setRegenerating(true);

    try {
      // Delete existing scheduled workouts
      await supabase
        .from('scheduled_workouts')
        .delete()
        .eq('user_id', user.id);

      // Delete existing plans
      await supabase
        .from('workout_plans')
        .delete()
        .eq('user_id', user.id);

      // Generate new weekly plan
      await supabase.functions.invoke('generate-weekly-plan', {
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

      toast.success('New plan generated! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e) {
      console.error('Regenerate error:', e);
      toast.error('Failed to regenerate plan. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Update your training preferences</p>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Training Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm transition-all",
                    goal === g.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Experience Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {levels.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm transition-all",
                    level === l.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Focus & Equipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">Focus</label>
              <div className="flex flex-wrap gap-2">
                {focuses.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFocus(f.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-all",
                      focus === f.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">Equipment</label>
              <div className="flex gap-2">
                {equipmentOptions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEquipment(e.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-all",
                      equipment === e.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Session Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Time available</span>
              <span className="text-sm font-medium tabular">{duration} min</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([v]: number[]) => setDuration(v)}
              min={15}
              max={90}
              step={5}
            />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Workout Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {dayLabels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "flex-1 h-10 rounded-lg text-sm font-medium transition-all",
                    workoutDays.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
          <Button onClick={handleRegenerate} disabled={regenerating} variant="outline" className="gap-2">
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Regenerate Plan
          </Button>
        </div>
      </main>
    </div>
  );
}
