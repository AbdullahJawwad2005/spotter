// AI coach edge function — calls Lovable AI Gateway with session + history context.
// CORS via Supabase SDK.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface RepLite {
  score: number;
  depth: number;
  back: number;
  durMs: number;
}

interface SessionPayload {
  exercise: "squat" | "deadlift" | "bench";
  session: { avgScore: number; reps: RepLite[]; topCue: string };
  history?: { exercise: string; date: string; reps: number; avgScore: number; topCue: string }[];
}

const SYSTEM_PROMPT = `You are an NSCA-certified strength and conditioning coach. You give short, specific feedback — no fluff, no generic advice.

Constraints:
- Strict 90 to 110 word response.
- Reference the user's specific reps by index (e.g. "rep 4", "your last two reps").
- If history is provided, compare to the trend (e.g. "depth improved 8% vs last session").
- Plain prose, no headers, no bullet lists, no markdown.
- Tone: confident, direct, like a coach who respects the lifter's time.
- End with one clear thing to focus on next session.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SessionPayload;
    if (!body?.session?.reps?.length) {
      return new Response(JSON.stringify({ error: "No session data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build user message
    const repLines = body.session.reps
      .map((r, i) => `Rep ${i + 1}: score ${r.score}, depth ${r.depth}°, back lean ${r.back}°, ${(r.durMs / 1000).toFixed(1)}s`)
      .join("\n");

    const historyLines = (body.history ?? [])
      .map((h, i) => `Session ${i + 1} (${new Date(h.date).toLocaleDateString()}, ${h.exercise}): ${h.reps} reps, avg ${h.avgScore}, top issue "${h.topCue}"`)
      .join("\n");

    const userMessage = `Exercise: ${body.exercise}
Average rep score: ${body.session.avgScore}
Top recurring cue this set: ${body.session.topCue}

Reps:
${repLines}

${historyLines ? `Recent sessions:\n${historyLines}` : "No prior sessions on record."}

Give the lifter their coaching summary now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
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

    const data = await aiRes.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
