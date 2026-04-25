import { useEffect, useRef } from "react";
import { BONES, type Landmark } from "@/lib/pose-math";

interface Props {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  riskScore: number;
}

export function SkeletonCanvas({ landmarks, width, height, riskScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks?.length) return;

    // Color: teal default, red if injury risk high
    const teal = riskScore > 70 ? "#e54848" : riskScore > 45 ? "#e2a93b" : "#1aa9a3";
    const tealSoft = riskScore > 70 ? "rgba(229,72,72,0.25)" : riskScore > 45 ? "rgba(226,169,59,0.3)" : "rgba(26,169,163,0.25)";

    // Bones
    ctx.lineWidth = 3;
    ctx.strokeStyle = teal;
    ctx.shadowColor = tealSoft;
    ctx.shadowBlur = 8;
    for (const [a, b] of BONES) {
      const la = landmarks[a]; const lb = landmarks[b];
      if (!la || !lb) continue;
      if ((la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) continue;
      ctx.beginPath();
      ctx.moveTo(la.x * canvas.width, la.y * canvas.height);
      ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height);
      ctx.stroke();
    }
    // Joints
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fbfbf7";
    ctx.strokeStyle = teal;
    ctx.lineWidth = 2;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility ?? 1) < 0.3) continue;
      // Only draw the joints we care about
      if (![11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i)) continue;
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [landmarks, riskScore]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
}