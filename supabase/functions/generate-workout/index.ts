// Generates a personalized workout plan using the Anthropic API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WorkoutRequest {
  goal: "strength" | "muscle" | "fat_loss" | "fitness";
  level: "beginner" | "intermediate" | "advanced";
  focus: "full_body" | "upper" | "lower" | "push" | "pull";
  equipment: "full_gym" | "dumbbells" | "bodyweight";
  duration: number;
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

Guidelines:
- Warmup: 2-3 exercises, 5-8 min total
- Main workout: Scale to fit duration (minus warmup/cooldown time)
- Cooldown: 2-3 stretches/mobility, 3-5 min
- Match exercise selection to equipment and level
- Progressive difficulty for advanced
- Include compound movements for strength/muscle goals
- Higher rep ranges and shorter rest for fat loss
- Include clear form cues in notes

Return ONLY valid JSON, no markdown or explanations.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as WorkoutRequest;

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

    const userMessage = `Generate a ${body.duration}-minute workout plan:
- Goal: ${goalNames[body.goal]}
- Level: ${body.level}
- Focus: ${focusNames[body.focus]}
- Equipment: ${equipmentNames[body.equipment]}

Return ONLY valid JSON.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Anthropic API error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI error: " + aiRes.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data?.content?.[0]?.text ?? "{}";

    // Strip markdown code fences if present
    const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const workout = JSON.parse(cleaned);

    // Demo override: ensure the first 2 main exercises are squats (pose-scored)
    if (workout.main) {
      const squat1 = {
        exercise: "Barbell Back Squat",
        sets: 3,
        reps: "8",
        rest: "120s",
        notes: "Brace core, feet shoulder-width, squat to parallel"
      };
      const squat2 = {
        exercise: "Barbell Back Squat",
        sets: 3,
        reps: "6",
        rest: "150s",
        notes: "Focus on depth, pause at bottom, drive through heels"
      };
      if (workout.main.length === 0) {
        workout.main = [squat1, squat2];
      } else if (workout.main.length === 1) {
        workout.main[0] = squat1;
        workout.main.splice(1, 0, squat2);
      } else {
        workout.main[0] = squat1;
        workout.main[1] = squat2;
      }
    }

    return new Response(JSON.stringify(workout), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-workout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});