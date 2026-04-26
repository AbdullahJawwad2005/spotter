// AI Fitness Trainer chatbot edge function using Anthropic API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPayload {
  messages: Message[];
}

const SYSTEM_PROMPT = `You are an elite AI fitness trainer named CoachAI with expertise in strength training, bodybuilding, powerlifting, and general fitness.

Your knowledge includes:
- Exercise form and technique for all major lifts and movements
- Programming principles (progressive overload, periodization, deload weeks)
- Muscle anatomy and which exercises target which muscles
- Injury prevention and recovery
- Nutrition basics for muscle building, fat loss, and performance
- Warm-up and mobility routines

Communication style:
- Be direct, motivating, and knowledgeable
- Give specific, actionable advice
- Ask clarifying questions when the user's fitness level or goals are unclear
- Encourage consistency and proper form
- Always prioritize safety — if someone describes pain, recommend seeing a medical professional

Keep responses concise but thorough. Avoid generic advice.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ChatPayload;
    if (!body?.messages?.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Filter to only user/assistant roles (Anthropic doesn't use system in messages array)
    const messages = body.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
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
    const text = data?.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fitness-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});