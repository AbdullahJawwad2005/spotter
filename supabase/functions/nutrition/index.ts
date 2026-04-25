// AI Nutrition Assistant edge function.
// Handles meal logging with calorie estimation and meal plan generation.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface LogMealRequest {
  type: "log_meal";
  description: string;
}

interface GeneratePlanRequest {
  type: "generate_plan";
  goal: "muscle_gain" | "fat_loss" | "maintenance";
  calories: number;
  meals_per_day: number;
  dietary_restrictions?: string[];
}

type NutritionRequest = LogMealRequest | GeneratePlanRequest;

const LOG_MEAL_PROMPT = `You are a nutrition expert. Analyze the food description and estimate nutritional information.

Output format (JSON):
{
  "food_name": "cleaned up name of the food",
  "serving_size": "estimated portion",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "fiber": number (grams),
  "notes": "brief note about the meal quality or suggestions"
}

Be reasonable with estimates. If the description is vague, make educated guesses based on typical portions.
Return ONLY valid JSON.`;

const MEAL_PLAN_PROMPT = `You are a nutrition expert and meal planner. Create a full day meal plan based on the specifications.

Output format (JSON):
{
  "daily_totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "meals": [
    {
      "name": "Breakfast/Lunch/Dinner/Snack",
      "time": "suggested time",
      "foods": [
        {
          "item": "food name",
          "portion": "serving size",
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number
        }
      ],
      "meal_totals": { "calories": number, "protein": number, "carbs": number, "fat": number },
      "prep_notes": "quick prep tips"
    }
  ],
  "tips": ["2-3 tips for following this plan"]
}

Guidelines:
- Match total calories closely to target
- Protein: 1g per lb bodyweight for muscle gain, 0.8g for others (assume 160lb person if not specified)
- Include whole foods, minimize processed
- Balance macros across meals
- Make meals practical and easy to prepare
- Consider meal timing for the goal

Return ONLY valid JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as NutritionRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userMessage: string;

    if (body.type === "log_meal") {
      systemPrompt = LOG_MEAL_PROMPT;
      userMessage = `Analyze this meal: ${body.description}`;
    } else if (body.type === "generate_plan") {
      systemPrompt = MEAL_PLAN_PROMPT;
      const goalNames = {
        muscle_gain: "Muscle Building (high protein, caloric surplus)",
        fat_loss: "Fat Loss (high protein, caloric deficit)",
        maintenance: "Maintenance (balanced macros)",
      };
      userMessage = `Create a ${body.meals_per_day}-meal daily plan:
- Goal: ${goalNames[body.goal]}
- Target Calories: ${body.calories}
${body.dietary_restrictions?.length ? `- Dietary Restrictions: ${body.dietary_restrictions.join(", ")}` : ""}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid request type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
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
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutrition error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
