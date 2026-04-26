import { FrameMetrics, Smoother } from "./pose-math";

export type Phase = "standing" | "descending" | "bottom" | "ascending";

export interface RepFeedback {
  /** Short label of the main issue, e.g. "Shallow depth". "Clean rep" if none. */
  issue: string;
  /** Concrete actionable instruction, e.g. "Sit 2 inches lower; break parallel before driving up." */
  fix: string;
  /** Short voice line spoken aloud after the rep. */
  voice: string;
  severity: "good" | "minor" | "major";
}

export interface RepResult {
  index: number;
  score: number;          // 0-100
  depth: number;          // smallest knee angle reached (smaller = deeper)
  maxBackLean: number;    // degrees from vertical
  asymmetry: number;      // worst frame asymmetry
  durationMs: number;
  cues: string[];         // flagged issues
  primaryCue: string;     // headline cue spoken aloud
  feedback: RepFeedback;  // detailed per-rep feedback for UI + voice
}

export interface RealtimeState {
  phase: Phase;
  repCount: number;
  currentDepth: number;       // running min knee angle this rep
  liveScore: number;          // last completed rep score (or 100 baseline)
  liveCue: string;
  reps: RepResult[];
  riskScore: number;          // 0-100 cumulative
}

// Thresholds (degrees). Smaller knee angle = deeper squat.
const STAND_THRESHOLD = 160; // straighter than this = standing
const DESCEND_THRESHOLD = 150;
const BOTTOM_THRESHOLD = 100; // knee angle <= 100 considered at depth (parallel-ish)
const TARGET_DEPTH = 90;      // ideal: hit ~90 deg knee
const MAX_BACK_LEAN_OK = 45;  // degrees from vertical
const MAX_ASYMMETRY_OK = 8;

// Rehab mode is more conservative: punish less depth, alert sooner on lean
const REHAB = {
  TARGET_DEPTH: 110,
  MAX_BACK_LEAN_OK: 30,
  MAX_ASYMMETRY_OK: 5,
};

export interface EngineOptions {
  rehab?: boolean;
  /** User-calibrated min knee angle (deepest comfortable squat). If set, scoring grades against this. */
  calibratedDepth?: number;
}

export class SquatEngine {
  private kneeSmoother = new Smoother(5);
  private backSmoother = new Smoother(5);
  private asymSmoother = new Smoother(5);

  private phase: Phase = "standing";
  private repIndex = 0;
  private repStartedAt = 0;
  private minKnee = 180;
  private maxBack = 0;
  private maxAsym = 0;
  private liveScore = 100;
  private liveCue = "Ready";
  private reps: RepResult[] = [];

  constructor(private opts: EngineOptions = {}) {}

  setOptions(opts: EngineOptions) {
    this.opts = { ...this.opts, ...opts };
  }

  reset() {
    this.kneeSmoother.reset();
    this.backSmoother.reset();
    this.asymSmoother.reset();
    this.phase = "standing";
    this.repIndex = 0;
    this.minKnee = 180;
    this.maxBack = 0;
    this.maxAsym = 0;
    this.liveScore = 100;
    this.liveCue = "Ready";
    this.reps = [];
  }

  /** Feed one frame of metrics, returns the live state. */
  update(m: FrameMetrics | null, now: number): RealtimeState {
    if (!m) return this.state();

    const knee = this.kneeSmoother.push(m.kneeAngle);
    const back = this.backSmoother.push(m.backFromVertical);
    const asym = this.asymSmoother.push(m.asymmetry);

    // Phase machine
    const prev = this.phase;
    if (this.phase === "standing" && knee < DESCEND_THRESHOLD) {
      this.phase = "descending";
      this.repStartedAt = now;
      this.minKnee = knee;
      this.maxBack = back;
      this.maxAsym = asym;
    } else if (this.phase === "descending") {
      this.minKnee = Math.min(this.minKnee, knee);
      this.maxBack = Math.max(this.maxBack, back);
      this.maxAsym = Math.max(this.maxAsym, asym);
      if (knee <= BOTTOM_THRESHOLD) this.phase = "bottom";
      else if (knee > this.minKnee + 8) this.phase = "ascending";
    } else if (this.phase === "bottom") {
      this.minKnee = Math.min(this.minKnee, knee);
      this.maxBack = Math.max(this.maxBack, back);
      this.maxAsym = Math.max(this.maxAsym, asym);
      if (knee > BOTTOM_THRESHOLD + 5) this.phase = "ascending";
    } else if (this.phase === "ascending") {
      this.maxBack = Math.max(this.maxBack, back);
      this.maxAsym = Math.max(this.maxAsym, asym);
      if (knee >= STAND_THRESHOLD) {
        // Rep complete
        const rep = this.scoreRep(now);
        this.reps.push(rep);
        this.liveScore = rep.score;
        this.liveCue = rep.primaryCue;
        this.phase = "standing";
        this.minKnee = 180;
        this.maxBack = 0;
        this.maxAsym = 0;
      }
    }

    // Live cue heuristics during the rep
    if (this.phase !== "standing" && prev !== "standing") {
      if (back > (this.opts.rehab ? REHAB.MAX_BACK_LEAN_OK : MAX_BACK_LEAN_OK)) {
        this.liveCue = "Chest up";
      } else if (asym > (this.opts.rehab ? REHAB.MAX_ASYMMETRY_OK : MAX_ASYMMETRY_OK) * 1.6) {
        this.liveCue = "Even your knees";
      } else if (this.phase === "descending") {
        this.liveCue = "Drive down";
      } else if (this.phase === "bottom") {
        this.liveCue = "Hold and drive up";
      } else if (this.phase === "ascending") {
        this.liveCue = "Stand tall";
      }
    }

    return this.state();
  }

  private scoreRep(now: number): RepResult {
    const targetDepth = this.opts.calibratedDepth ??
      (this.opts.rehab ? REHAB.TARGET_DEPTH : TARGET_DEPTH);
    const maxBackOk = this.opts.rehab ? REHAB.MAX_BACK_LEAN_OK : MAX_BACK_LEAN_OK;
    const maxAsymOk = this.opts.rehab ? REHAB.MAX_ASYMMETRY_OK : MAX_ASYMMETRY_OK;

    let score = 100;
    const cues: string[] = [];

    // Depth: ideal at target. Penalize shallow harder than deep.
    const depthDelta = this.minKnee - targetDepth; // positive = shallow
    if (depthDelta > 0) {
      const penalty = Math.min(35, depthDelta * 1.2);
      score -= penalty;
      if (depthDelta > 12) cues.push("Go deeper — hit parallel");
    } else if (depthDelta < -25) {
      score -= 8;
      cues.push("Watch ATG depth, control the bottom");
    }

    // Back lean
    if (this.maxBack > maxBackOk) {
      const over = this.maxBack - maxBackOk;
      score -= Math.min(30, over * 1.4);
      cues.push("Drive your chest up");
    }

    // Asymmetry
    if (this.maxAsym > maxAsymOk) {
      const over = this.maxAsym - maxAsymOk;
      score -= Math.min(20, over * 1.0);
      cues.push("Even your knees");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const primaryCue = cues[0] ?? "Clean rep";

    // Build detailed feedback for UI + voice — pick the worst issue.
    const feedback = buildFeedback({
      score,
      depthDelta,
      backOver: this.maxBack - maxBackOk,
      asymOver: this.maxAsym - maxAsymOk,
      tooDeep: depthDelta < -25,
      durationMs: Math.max(400, now - this.repStartedAt),
    });

    this.repIndex += 1;
    return {
      index: this.repIndex,
      score,
      depth: this.minKnee,
      maxBackLean: this.maxBack,
      asymmetry: this.maxAsym,
      durationMs: Math.max(400, now - this.repStartedAt),
      cues,
      primaryCue,
      feedback,
    };
  }

  private state(): RealtimeState {
    const recent = this.reps.slice(-5);
    let risk = 0;
    if (recent.length) {
      const avgScore = recent.reduce((s, r) => s + r.score, 0) / recent.length;
      const decay = recent.length >= 3
        ? Math.max(0, recent[0].score - recent[recent.length - 1].score)
        : 0;
      risk = Math.min(100, Math.round((100 - avgScore) * 0.7 + decay * 1.5));
    }
    return {
      phase: this.phase,
      repCount: this.repIndex,
      currentDepth: this.minKnee,
      liveScore: this.liveScore,
      liveCue: this.liveCue,
      reps: this.reps,
      riskScore: risk,
    };
  }
}

interface FeedbackInput {
  score: number;
  /** positive = shallow (didn't reach target), negative = past target */
  depthDelta: number;
  /** positive = exceeded back-lean tolerance */
  backOver: number;
  /** positive = exceeded asymmetry tolerance */
  asymOver: number;
  tooDeep: boolean;
  durationMs: number;
}

function buildFeedback(input: FeedbackInput): RepFeedback {
  const { score, depthDelta, backOver, asymOver, tooDeep, durationMs } = input;

  // Pick the dominant issue by largest penalty contribution.
  const issues: { kind: string; weight: number }[] = [];
  if (depthDelta > 0) issues.push({ kind: "shallow", weight: depthDelta * 1.2 });
  if (backOver > 0) issues.push({ kind: "lean", weight: backOver * 1.4 });
  if (asymOver > 0) issues.push({ kind: "asym", weight: asymOver * 1.0 });
  if (tooDeep) issues.push({ kind: "deep", weight: 8 });
  if (durationMs < 800) issues.push({ kind: "fast", weight: 10 });

  if (!issues.length) {
    return {
      issue: "Clean rep",
      fix: "Same tempo, same depth — keep stacking reps like that.",
      voice: "Clean rep.",
      severity: "good",
    };
  }

  issues.sort((a, b) => b.weight - a.weight);
  const top = issues[0].kind;
  const severity: RepFeedback["severity"] = score >= 75 ? "minor" : "major";

  switch (top) {
    case "shallow":
      return {
        issue: `Shallow by ~${Math.round(depthDelta)}°`,
        fix: "Sit your hips back and down further — break parallel before driving up. Try slowing the descent so you actually reach depth.",
        voice: "Go deeper. Hit parallel before standing.",
        severity,
      };
    case "lean":
      return {
        issue: `Chest dropped ~${Math.round(backOver)}° too far`,
        fix: "Brace your core, eyes forward, and lead with your chest on the way up. Think 'proud chest' through the whole rep.",
        voice: "Chest up. Brace harder.",
        severity,
      };
    case "asym":
      return {
        issue: `Knee imbalance ~${Math.round(asymOver)}°`,
        fix: "Drive evenly through both feet — push the floor away with the weaker side. Spread your toes and grip the ground.",
        voice: "Even your knees. Push both feet down.",
        severity,
      };
    case "deep":
      return {
        issue: "Dropped past control range",
        fix: "Stop ~5° above your max; bouncing the bottom puts your knees and lower back at risk. Pause for a beat at depth instead.",
        voice: "Control the bottom. No bounce.",
        severity,
      };
    case "fast":
      return {
        issue: "Tempo too fast",
        fix: "Aim for ~1 second down, brief pause, ~1 second up. Speed hides form breakdown — slow it down to own the rep.",
        voice: "Slow it down. Own the tempo.",
        severity,
      };
    default:
      return {
        issue: "Form drift",
        fix: "Reset your stance and breath before the next rep.",
        voice: "Reset. Then go again.",
        severity,
      };
  }
}