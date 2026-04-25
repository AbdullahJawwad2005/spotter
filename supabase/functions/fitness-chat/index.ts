// AI Fitness Trainer chatbot edge function — streaming chat with fitness context.
// Uses Lovable AI Gateway with OpenAI model.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatPayload {
  messages: Message[];
}

const SYSTEM_PROMPT = `You are an elite AI fitness trainer with expertise in strength training, bodybuilding, powerlifting, and general fitness. Your name is CoachAI.

Your knowledge includes:
- Exercise form and technique for all major lifts and movements
- Programming principles (progressive overload, periodization, deload weeks)
- Muscle anatomy and which exercises target which muscles
- Injury prevention and recovery
- Nutrition basics for muscle building, fat loss, and performance
- Warm-up and mobility routines
- Rest and recovery optimization

Communication style:
- Be direct, motivating, and knowledgeable
- Give specific, actionable advice
- Reference proper form cues when discussing exercises
- Ask clarifying questions when the user's fitness level or goals are unclear
- Encourage consistency and proper form over ego lifting
- Be supportive but honest — don't sugarcoat when someone needs to improve

Always prioritize safety. If someone describes pain or potential injury, recommend they see a medical professional.

Keep responses concise but thorough. Use numbered lists for multi-step instructions. Avoid generic advice — be specific to what the user asks.`;

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build messages array with system prompt
    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages,
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add more in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response back
    return new Response(aiRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("fitness-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
