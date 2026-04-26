// AI Nutrition Assistant edge function using Anthropic API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Output format (JSON only):
{
  "food_name": "cleaned up name",
  "serving_size": "estimated portion",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "notes": "brief note"
}

Return ONLY valid JSON, no markdown.`;

const MEAL_PLAN_PROMPT = `You are a nutrition expert and meal planner. Create a full day meal plan.

Output format (JSON only):
{
  "daily_totals": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "meals": [
    {
      "name": "Breakfast/Lunch/Dinner/Snack",
      "time": "suggested time",
      "foods": [
        { "item": "food name", "portion": "serving size", "calories": number, "protein": number, "carbs": number, "fat": number }
      ],
      "meal_totals": { "calories": number, "protein": number, "carbs": number, "fat": number },
      "prep_notes": "quick prep tips"
    }
  ],
  "tips": ["2-3 tips"]
}

Return ONLY valid JSON, no markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as NutritionRequest;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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
        system: systemPrompt,
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
    const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(cleaned);

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