// AI coach edge function — post-set debrief using Anthropic API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SetRecord {
  exerciseName: string;
  setIndex: number;
  totalSets: number;
  targetReps: number;
  reps: { score?: number; depth?: number; back?: number; durMs?: number; ok?: boolean }[];
  topCue?: string;
  formScored: boolean;
  prevAvgScore?: number;
}

const SYSTEM_PROMPT = `You are an expert strength and conditioning coach giving post-set feedback.

Analyse the set data and return ONLY this JSON (no markdown, no extra text):
{
  "headline": "One punchy sentence summarising the set (≤12 words)",
  "didWell": "Specific positive — what the lifter actually did right (1-2 sentences)",
  "fellShort": "Most significant issue — concrete, not generic (1-2 sentences)",
  "commonMistake": "The single most common mistake for this exercise at this level (1-2 sentences)",
  "improvement": "Comparison vs prev set or general trend (1 sentence; say 'First set on record' if no prior data)",
  "injuryRisk": "low" | "moderate" | "high",
  "injuryRiskNote": "Why that risk level — anatomy / mechanics (1 sentence)",
  "focusNext": "One actionable cue for the next set (≤10 words)"
}

Rules:
- Be specific: reference actual scores, depth numbers, rep counts when available
- If formScored=false, base feedback on rep count vs target only (tap-count mode)
- Never use filler phrases like "Great job!" or "Keep it up!"
- injuryRisk must be "low" when formScored=false and reps are close to target`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SetRecord;

    if (!body?.exerciseName) {
      return new Response(JSON.stringify({ error: "No session data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Build rep description
    let repDesc: string;
    if (body.formScored && body.reps.length > 0) {
      const avgScore = Math.round(
        body.reps.reduce((s, r) => s + (r.score ?? 0), 0) / body.reps.length
      );
      const repLines = body.reps
        .map((r, i) =>
          `Rep ${i + 1}: score ${r.score ?? "n/a"}, depth ${r.depth ?? "?"}°, back lean ${r.back ?? "?"}°, ${r.durMs ? (r.durMs / 1000).toFixed(1) + "s" : "?"}`
        )
        .join("\n");
      repDesc = `Form-scored set. Avg score: ${avgScore}/100.\n${repLines}`;
    } else if (!body.formScored && body.reps.length > 0) {
      const goodReps = body.reps.filter((r) => r.ok).length;
      repDesc = `Tap-count set. Completed ${body.reps.length} reps (${goodReps} good) of target ${body.targetReps}.`;
    } else {
      repDesc = `Set completed. Target: ${body.targetReps} reps.`;
    }

    const userMessage = `Exercise: ${body.exerciseName}
Set ${body.setIndex} of ${body.totalSets}
${body.topCue ? `Top cue this set: ${body.topCue}` : ""}
${body.prevAvgScore !== undefined ? `Previous avg score: ${body.prevAvgScore}/100` : "No previous set data"}

${repDesc}

Give the coaching summary now.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
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
    const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const summary = JSON.parse(cleaned);

    return new Response(JSON.stringify({ summary }), {
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