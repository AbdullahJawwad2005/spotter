// Generate a weekly workout plan and schedule it across the user's chosen days.
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WeeklyPlanRequest {
  userId: string;
  goal: "strength" | "muscle" | "fat_loss" | "fitness";
  level: "beginner" | "intermediate" | "advanced";
  focus: "full_body" | "upper" | "lower" | "push" | "pull";
  equipment: "full_gym" | "dumbbells" | "bodyweight";
  duration: number;
  workoutDays: number[];
}

const SYSTEM_PROMPT = `You are an expert strength and conditioning coach. Generate a structured workout plan based on the user's specifications.

Output format (JSON):
{
  "title": "Workout name",
  "warmup": [
    { "exercise": "name", "duration": "time or reps", "notes": "optional form cue" }
  ],
  "main": [
    {
      "exercise": "name",
      "sets": number,
      "reps": "rep range or time",
      "rest": "rest time",
      "notes": "key form cues"
    }
  ],
  "cooldown": [
    { "exercise": "name", "duration": "time", "notes": "optional" }
  ],
  "tips": ["1-2 key tips for this workout"]
}

Return ONLY valid JSON, no markdown or explanations.`;

const focusVariations: Record<string, string[]> = {
  full_body: ["Full Body A", "Full Body B"],
  upper: ["Upper Push", "Upper Pull"],
  lower: ["Lower Quad Focus", "Lower Posterior Chain"],
  push: ["Push Heavy", "Push Volume"],
  pull: ["Pull Heavy", "Pull Volume"],
};

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string): Promise<object | null> {
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!aiRes.ok) {
    console.error("Anthropic API error:", aiRes.status, await aiRes.text());
    return null;
  }

  const data = await aiRes.json();
  const content = data?.content?.[0]?.text ?? "{}";
  const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as WeeklyPlanRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const goalNames: Record<string, string> = {
      strength: "Build Strength (heavy weight, low reps, long rest)",
      muscle: "Build Muscle (moderate weight, 8-12 reps, hypertrophy focus)",
      fat_loss: "Burn Fat (higher reps, short rest, metabolic conditioning)",
      fitness: "General Fitness (balanced, functional movements)",
    };
    const focusNames: Record<string, string> = {
      full_body: "Full Body",
      upper: "Upper Body (chest, back, shoulders, arms)",
      lower: "Lower Body (quads, hamstrings, glutes, calves)",
      push: "Push (chest, shoulders, triceps)",
      pull: "Pull (back, biceps, rear delts)",
    };
    const equipmentNames: Record<string, string> = {
      full_gym: "Full Gym (barbells, dumbbells, machines, cables)",
      dumbbells: "Dumbbells Only",
      bodyweight: "Bodyweight Only",
    };

    const variations = focusVariations[body.focus] || ["Workout A", "Workout B"];
    const plans: Array<{ id: string; title: string }> = [];

    for (const variation of variations) {
      const userMessage = `Generate a ${body.duration}-minute workout plan:
- Goal: ${goalNames[body.goal]}
- Level: ${body.level}
- Focus: ${focusNames[body.focus]} — ${variation}
- Equipment: ${equipmentNames[body.equipment]}

Return ONLY valid JSON.`;

      const workout = await callAnthropic(ANTHROPIC_API_KEY, SYSTEM_PROMPT, userMessage) as Record<string, unknown> | null;
      if (!workout) continue;

      const { data: planData, error: planError } = await supabase
        .from("workout_plans")
        .insert({
          user_id: body.userId,
          title: (workout.title as string) || variation,
          goal: body.goal,
          level: body.level,
          focus: body.focus,
          equipment: body.equipment,
          duration: body.duration,
          plan_data: workout,
        })
        .select("id")
        .single();

      if (planError) { console.error("Plan insert error:", planError); continue; }
      plans.push({ id: planData.id, title: (workout.title as string) || variation });
    }

    if (plans.length > 0) {
      const today = new Date();
      const scheduledWorkouts: Array<{
        user_id: string; plan_id: string; scheduled_date: string;
        day_of_week: number; title: string; focus: string;
      }> = [];

      for (let week = 0; week < 4; week++) {
        for (const dayOfWeek of body.workoutDays) {
          const date = new Date(today);
          const currentDay = date.getDay();
          const daysUntil = ((dayOfWeek - currentDay + 7) % 7) + (week * 7);
          date.setDate(date.getDate() + daysUntil);

          const plan = plans[scheduledWorkouts.length % plans.length];
          scheduledWorkouts.push({
            user_id: body.userId,
            plan_id: plan.id,
            scheduled_date: date.toISOString().split("T")[0],
            day_of_week: dayOfWeek,
            title: plan.title,
            focus: body.focus,
          });
        }
      }

      const { error: scheduleError } = await supabase.from("scheduled_workouts").insert(scheduledWorkouts);
      if (scheduleError) console.error("Schedule insert error:", scheduleError);
    }

    return new Response(
      JSON.stringify({ success: true, plansCreated: plans.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-weekly-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});