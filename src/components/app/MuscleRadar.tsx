import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { Exercise } from "@/lib/exercises";

export function MuscleRadar({ exercise, intensity }: { exercise: Exercise; intensity: number }) {
  const data = exercise.muscles.map((m) => ({
    muscle: m.label,
    value: Math.round(m.weight * 100 * Math.max(0.3, intensity)),
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="78%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="muscle"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Radar
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
