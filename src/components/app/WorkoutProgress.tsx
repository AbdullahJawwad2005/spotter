import { Check, Circle, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanData } from '@/hooks/useWorkoutPlan';

interface Props {
  planData: PlanData;
  planTitle: string;
  exerciseIndex: number;
  setsCompletedByIndex: number[];
}

export function WorkoutProgress({ planData, planTitle, exerciseIndex, setsCompletedByIndex }: Props) {
  const allExercises: { name: string; detail: string; totalSets: number }[] = [
    ...(planData.warmup || []).map((ex) => ({ name: ex.exercise, detail: ex.duration, totalSets: 1 })),
    ...(planData.main || []).map((ex) => ({ name: ex.exercise, detail: `${ex.sets}×${ex.reps}`, totalSets: ex.sets })),
    ...(planData.cooldown || []).map((ex) => ({ name: ex.exercise, detail: ex.duration, totalSets: 1 })),
  ];

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Today's plan</div>
        <div className="text-sm font-display mt-0.5 truncate">{planTitle}</div>
      </div>
      <ol className="divide-y divide-border">
        {allExercises.map((ex, i) => {
          const isDone = i < exerciseIndex;
          const isActive = i === exerciseIndex;
          const setsCompleted = setsCompletedByIndex[i] || 0;
          return (
            <li key={i} className={cn('px-4 py-3', isActive && 'bg-primary/5')}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center shrink-0',
                  isDone ? 'bg-success text-success-foreground'
                  : isActive ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
                )}>
                  {isDone ? <Check className="h-3 w-3" /> : isActive ? <Dot className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-display truncate', !isActive && !isDone && 'text-muted-foreground')}>
                    {ex.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{ex.detail}</div>
                </div>
              </div>
              {isActive && ex.totalSets > 1 && (
                <div className="mt-2 ml-8 flex items-center gap-1">
                  {Array.from({ length: ex.totalSets }).map((_, s) => (
                    <span key={s} className={cn(
                      'h-1.5 flex-1 rounded-full',
                      s < setsCompleted ? 'bg-success' : s === setsCompleted ? 'bg-primary animate-pulse' : 'bg-muted',
                    )} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}