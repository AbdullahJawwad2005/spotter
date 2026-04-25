// AI Workout Plan Generator edge function.
// Generates personalized workout plans based on user inputs.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface WorkoutRequest {
  goal: "strength" | "muscle" | "fat_loss" | "fitness";
  level: "beginner" | "intermediate" | "advanced";
  focus: "full_body" | "upper" | "lower" | "push" | "pull";
  equipment: "full_gym" | "dumbbells" | "bodyweight";
  duration: number; // in minutes
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
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const goalNames = {
      strength: "Build Strength (heavy weight, low reps, long rest)",
      muscle: "Build Muscle (moderate weight, 8-12 reps, hypertrophy focus)",
      fat_loss: "Burn Fat (higher reps, short rest, metabolic conditioning)",
      fitness: "General Fitness (balanced, functional movements)",
    };

    const focusNames = {
      full_body: "Full Body",
      upper: "Upper Body (chest, back, shoulders, arms)",
      lower: "Lower Body (quads, hamstrings, glutes, calves)",
      push: "Push (chest, shoulders, triceps)",
      pull: "Pull (back, biceps, rear delts)",
    };

    const equipmentNames = {
      full_gym: "Full Gym (barbells, dumbbells, machines, cables)",
      dumbbells: "Dumbbells Only",
      bodyweight: "Bodyweight Only",
    };

    const userMessage = `Generate a ${body.duration}-minute workout plan with these specifications:
- Goal: ${goalNames[body.goal]}
- Experience Level: ${body.level}
- Focus: ${focusNames[body.focus]}
- Equipment: ${equipmentNames[body.equipment]}

Return the workout as JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    
    // Parse and return the workout plan
    const workout = JSON.parse(content);

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
