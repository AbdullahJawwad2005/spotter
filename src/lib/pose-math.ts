// Pose math — joint angle computation, smoothing, scoring.
// Works against MediaPipe Pose 33-landmark schema.

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_FOOT: 31,
  R_FOOT: 32,
} as const;

// Bone pairs we draw for the skeleton overlay
export const BONES: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31],
  [24, 26], [26, 28], [28, 32],
];

/** Angle ABC in degrees, using 3D coordinates. */
export function angle3D(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m1 = Math.hypot(v1.x, v1.y, v1.z);
  const m2 = Math.hypot(v2.x, v2.y, v2.z);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle of segment ab from vertical, 0 = straight up. Uses 2D y-axis. */
export function angleFromVertical(a: Landmark, b: Landmark): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y; // y increases downward
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

export function avgVisibility(lms: Landmark[], idxs: number[]): number {
  let s = 0, n = 0;
  for (const i of idxs) {
    const v = lms[i]?.visibility ?? 0;
    s += v; n++;
  }
  return n ? s / n : 0;
}

/** Per-frame metrics from a pose result. Returns null if visibility is too low. */
export interface FrameMetrics {
  kneeAngle: number;
  hipAngle: number;
  backFromVertical: number;
  asymmetry: number; // |left knee - right knee|
  stanceWidth: number;
}

export function squatMetrics(lms: Landmark[]): FrameMetrics | null {
  const need = [
    LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE,
    LM.L_ANKLE, LM.R_ANKLE, LM.L_SHOULDER, LM.R_SHOULDER,
  ];
  if (avgVisibility(lms, need) < 0.55) return null;

  const lKnee = angle3D(lms[LM.L_HIP], lms[LM.L_KNEE], lms[LM.L_ANKLE]);
  const rKnee = angle3D(lms[LM.R_HIP], lms[LM.R_KNEE], lms[LM.R_ANKLE]);
  const kneeAngle = (lKnee + rKnee) / 2;

  const lHip = angle3D(lms[LM.L_SHOULDER], lms[LM.L_HIP], lms[LM.L_KNEE]);
  const rHip = angle3D(lms[LM.R_SHOULDER], lms[LM.R_HIP], lms[LM.R_KNEE]);
  const hipAngle = (lHip + rHip) / 2;

  const midShoulder: Landmark = {
    x: (lms[LM.L_SHOULDER].x + lms[LM.R_SHOULDER].x) / 2,
    y: (lms[LM.L_SHOULDER].y + lms[LM.R_SHOULDER].y) / 2,
    z: (lms[LM.L_SHOULDER].z + lms[LM.R_SHOULDER].z) / 2,
  };
  const midHip: Landmark = {
    x: (lms[LM.L_HIP].x + lms[LM.R_HIP].x) / 2,
    y: (lms[LM.L_HIP].y + lms[LM.R_HIP].y) / 2,
    z: (lms[LM.L_HIP].z + lms[LM.R_HIP].z) / 2,
  };
  const backFromVertical = angleFromVertical(midHip, midShoulder);
  const asymmetry = Math.abs(lKnee - rKnee);
  const stanceWidth = Math.abs(lms[LM.L_ANKLE].x - lms[LM.R_ANKLE].x);

  return { kneeAngle, hipAngle, backFromVertical, asymmetry, stanceWidth };
}

/** Rolling smoother. */
export class Smoother {
  private buf: number[] = [];
  constructor(private size = 5) {}
  push(v: number): number {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  reset() { this.buf = []; }
}